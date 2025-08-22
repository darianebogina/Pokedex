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

type PaginationConfig = {
    sid: string;
    initialPage?: number;
    initialLimit?: number;
    maxLimit?: number;
};


const createPaginationModel = ({
                                   sid, initialPage = 0, initialLimit = 20,
                                   maxLimit = 100,
                               }: PaginationConfig) => {
    const setPage = createEvent<number>();
    const nextPage = createEvent();
    const prevPage = createEvent();
    const reset = createEvent();

    const setLimit = createEvent<number>();
    const setTotalItems = createEvent<number>();

    const countMaxPage = () => {
        if ($totalItems.getState() === null) return Infinity;
        return Math.ceil($totalItems.getState()! / $limit.getState());
    }

    const $currentPage = createStore(initialPage, {sid: `${sid}/currentPage`})
        .on(setPage, (_, page) => {
            if (page < 1) return 1;
            if ($totalItems.getState() !== null) {
                return Math.min(page, countMaxPage());
            }
            return page;
        })
        .on(nextPage, (page) => {
            return Math.min(page + 1, countMaxPage());
        })
        .on(prevPage, (page) => Math.max(1, page - 1))
        .reset(reset)

    const $limit = createStore(initialLimit, {sid: `${sid}/limit`})
        .on(setLimit, (_, limit) => Math.min(Math.max(1, limit), maxLimit))
        .reset(reset)

    const $totalItems = createStore<number | null>(null)
        .on(setTotalItems, (_, totalItems) => totalItems)
        .reset(reset)

    const $offset = combine($currentPage, $limit,
        (curPage: number, limit: number) => (curPage - 1) * limit);

    const $hasPrevPage = $currentPage.map((curPage) => curPage > 1);
    const $hasNextPage = combine($currentPage, $limit, $totalItems,
        (curPage, limit, total) => {
            if (total === 0) {
                return false;
            }
            return (curPage * limit) < (total ?? 0);
        });
    return {
        $currentPage,
        $limit,
        $offset,
        $hasNextPage,
        $hasPrevPage,
        $totalItems,
        nextPage,
        prevPage,
        setPage,
        setLimit,
        setTotalItems,
        reset,
    };
};


const $pokemonList = createStore<Array<Pokemon>>([]);
const $error = createStore<string | null>(null);

const setPokemonList = createEvent<Array<Pokemon>>();
$pokemonList.on(setPokemonList, (_, newList) => newList);

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

const pagination = createPaginationModel({
    sid: 'pokemonPagination',
});

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
    clock: [pagination.nextPage, pagination.prevPage],
    source: { limit: pagination.$limit, offset: pagination.$offset },
    target: getPokemonListFx,
});

sample({
    clock: getPokemonListFx.doneData,
    fn: ({count}) => count,
    target: pagination.setTotalItems,
});

sample({
    clock: getPokemonListFx.doneData,
    target: getPokemonsFx,
})

sample({
    clock: getPokemonsFx.doneData,
    target: setPokemonList,
});

const PokemonList = () => {
    const loading = useUnit($loadingPokemonList);
    const pokemonFilledList = useUnit($pokemonList);
    const totalPokemon = useUnit(pagination.$totalItems);
    const hasNextPage = useUnit(pagination.$hasNextPage);
    const hasPrevPage = useUnit(pagination.$hasPrevPage);
    const curPage = useUnit(pagination.$currentPage);

    const next = useUnit(pagination.nextPage);
    const prev = useUnit(pagination.prevPage);
    const error = useUnit($error);
    useEffect(() => {
        next();
    }, [])

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
                    <button onClick={() => pagination.nextPage()}>Retry</button>
                </div>
            ) : (
                <>
                    <ul className="cards-list">{pokemonItems}</ul>
                    {loading ? (
                        <div className="loader">Loading...</div>
                    ) : (
                        pokemonFilledList.length < (totalPokemon ?? 0) &&
                        <div className="buttons">
                            <button onClick={prev} disabled={!hasPrevPage}>Prev</button>
                            <p>{curPage}</p>
                            <button onClick={next} disabled={!hasNextPage}>Next</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
