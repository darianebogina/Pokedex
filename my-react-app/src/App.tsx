import './App.css'
import {combine, createEffect, createEvent, createStore, sample} from "effector";
import {useList, useUnit} from "effector-react";
import {useEffect} from "react";

export const App = () => {
    return (
        <>
            <PokemonList>
            </PokemonList>
        </>
    )
};

const POKEMON_PER_PAGE = 20;

type Pokemon = {
    source: string,
    name: string,
    id: number,
    type: string[],
}

type PokemonListResponse = {
    urls: string[],
    count: number,
};

const $pokemonList = createStore<Array<Pokemon>>([]);
const $total = createStore(0);
const $error = createStore<string | null>(null);

const showMore = createEvent<void>();

const getPokemonListFx = createEffect<{ limit: number; offset: number }, PokemonListResponse>
(async ({limit, offset}) => {
    const url = `https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    const responseData = await response.json();
    return {
        urls: responseData.results.map((item: { name: string, url: string }) => item.url),
        count: responseData.count,
    };
});

const getPokemonsFx = createEffect(async ({urls} : Pick<PokemonListResponse, "urls">) => {

    const getPokemonData = async (url: string) => {
        const response = await fetch(url);
        const responseData = await response.json();

        const pokemon: Pokemon = {
            source: responseData.sprites.front_default,
            name: responseData.name,
            id: responseData.id,
            type: responseData.types.map((item: { slot: number, type: { name: string, url: string } }) => item.type.name),
        };
        return pokemon;
    }
    return Promise.all(urls.map(getPokemonData))
});

const $loadingPokemonList = combine(
    getPokemonListFx.pending,
    getPokemonsFx.pending,
    (listPending, pokemonPending) => listPending || pokemonPending
);

sample({
    clock: [getPokemonListFx.failData, getPokemonsFx.failData],
    fn: (error) => error.message,
    target: $error,
});

sample({
    clock: [getPokemonListFx.done, getPokemonsFx.done],
    target: $error.reinit,
});

sample({
    clock: showMore,
    source: $pokemonList,
    fn: (pokemonArr) => ({
        limit: POKEMON_PER_PAGE,
        offset: pokemonArr.length,
    }),
    target: getPokemonListFx,
});

sample({
    clock: getPokemonListFx.doneData,
    target: getPokemonsFx,
})

sample({
    clock: getPokemonListFx.doneData,
    fn: ({count}) => count,
    target: $total,
});

sample({
    clock: getPokemonsFx.doneData,
    source: $pokemonList,
    fn: ((pokemonList, newPokemon) => [...pokemonList, ...newPokemon]),
    target: $pokemonList,
});

const PokemonList = () => {
    const loading = useUnit($loadingPokemonList);
    const pokemonFilledList = useUnit($pokemonList);
    const totalPokemon = useUnit($total);
    const error = useUnit($error);
    useEffect(() => {
        showMore();
    }, []);

    const pokemonItems = useList(($pokemonList), (pokemon) => (
        <li key={pokemon.id} className="card-item">
            <img src={pokemon.source} alt={pokemon.name}/>
            <h3>{pokemon.name}</h3>
            <p>{pokemon.id}</p>
            <p>{pokemon.type.join(", ")}</p>
        </li>
    ));

    return (
        <div className="cards">
            {error ? (
                <div>
                    <p>Ошибка: {error}</p>
                    <button onClick={() => showMore()}>Retry</button>
                </div>
            ) : (
                <>
                    <ul className="cards-list">{pokemonItems}</ul>
                    {loading ? (
                        <div className="loader">Loading...</div>
                    ) : (
                        pokemonFilledList.length < totalPokemon &&
                        <button onClick={() => showMore()}>Show more</button>
                    )}
                </>
            )}
        </div>
    );
};
