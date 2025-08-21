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

const showMore = createEvent<void>();
const pokemonFilled = createEvent<Pokemon>();
$pokemonList.on(pokemonFilled, (pokemonList: Array<Pokemon>, pokemon: Pokemon) =>
    [...pokemonList, pokemon]);

const getPokemonListFx = createEffect<{ limit: number; offset: number}, PokemonListResponse>
( async ({limit, offset}) => {
    const url = `https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    const responseData = await response.json();
    return {
        urls: responseData.results.map((item: { name: string, url: string }) => item.url),
        count: responseData.count,
    };
});

const getPokemonFx = createEffect<string, Pokemon>(async (url) => {
    const response = await fetch(url);
    const responseData = await response.json();

    const pokemon: Pokemon = {
        source: responseData.sprites.front_default,
        name: responseData.name,
        id: responseData.id,
        type: responseData.types.map((item: { slot: number, type: { name: string, url: string } }) => item.type.name),
    };
    return pokemon;
});

const $loadingPokemonList = combine(
    getPokemonListFx.pending,
    getPokemonFx.pending,
    (listPending, pokemonPending) => listPending || pokemonPending
);

sample({
    clock: showMore,
    source: $pokemonList,
    fn: (pokemonArr) => ({
        limit: 20,
        offset: pokemonArr.length,
    }),
    target: getPokemonListFx,
});

sample({
    clock: getPokemonListFx.doneData,
    fn: ({ urls }) => urls,
}).watch((urls) => {
    urls.forEach((url) => {
        getPokemonFx(url);
    });
});

sample({
    clock: getPokemonListFx.doneData,
    fn: ({ count }) => count,
    target: $total,
});

sample({
    clock: getPokemonFx.doneData,
    target: pokemonFilled,
});

const PokemonList = () => {
    const loading = useUnit($loadingPokemonList);
    const pokemonFilledList = useUnit($pokemonList);
    const totalPokemon = useUnit($total);
    useEffect(() => {
        showMore();
    }, []);

    const pokemonItems = useList(($pokemonList), (pokemon, index) => (
        <li key={pokemon.id * Math.pow((index + 1), 2)} className="card-item">
            <img src={pokemon.source} alt={pokemon.name}/>
            <h3>{pokemon.name}</h3>
            <p>{pokemon.id}</p>
            <p>{pokemon.type.join(", ")}</p>
        </li>
    ));

    return (
        <div className="cards">
            <ul className="cards-list">{pokemonItems}</ul>
            {loading ? (
                <div className="loader">Loading...</div>
            ) : (
                (pokemonFilledList.length < totalPokemon)&& <button onClick={() => showMore()}>Show more</button>
            )}
        </div>
    );
};
