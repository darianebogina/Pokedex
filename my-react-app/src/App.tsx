// import { useState } from 'react'
import './App.css'
import {createEffect, createEvent, createStore, sample} from "effector";
import { useUnit } from "effector-react";
import {useEffect} from "react";

export const App = () => {
    getPokemonsListFx().then((list) => console.log(list));
    getPokemonFx().then((item) => console.log(item));
    return (
        <div>
            <PokemonList>

            </PokemonList>
        </div>
    )
};

type Pokemon = {
    source: string,
    name: string,
    id: number,
    type: string[],
}

const $pokemonsList = createStore<Array<Pokemon>>([]);
const pokemonFilled = createEvent<Pokemon>();
$pokemonsList.on(pokemonFilled, (pokemonsList: Array<Pokemon>, pokemon: Pokemon) =>
    [...pokemonsList, pokemon]);

const getPokemonsListFx = createEffect(async () => {
    const url = "https://pokeapi.co/api/v2/pokemon?limit=20&offset=0";
    const response = await fetch(url);
    const responseData = await response.json();
    return responseData.results.map((item: {name: string, url: string}) => item.url) as Array<string>;
});

const getPokemonFx = createEffect(async () => {
    const url = "https://pokeapi.co/api/v2/pokemon/1/";
    const response = await fetch(url);
    const responseData = await response.json();


    const pokemon: Pokemon = {
        source: responseData.sprites.front_default,
        name: responseData.name,
        id: responseData.id,
        type: responseData.types.map((item: {slot: number, type: {name: string, url: string}}) => item.type.name),
    };
    return pokemon;
});

sample({
    clock: getPokemonFx.doneData,
    target: pokemonFilled,
});

const PokemonList =() => {
    const pokemons = useUnit($pokemonsList);
    useEffect(() => {
        getPokemonFx();
    }, []);
    return (
        <>
            <div>{pokemons}</div>
        </>
    )
};