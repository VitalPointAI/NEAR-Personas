import React, { useContext, useEffect } from 'react';
import { appStore, onAppMount } from './state/app';

import { Container } from './components/Container'
import { Receiver } from './components/Receiver'
import { Giver } from './components/Giver'
import { CircularProgress } from '@material-ui/core';

// helpers
export const btnClass = 'btn btn-sm btn-outline-primary mb-3 '
export const flexClass = 'd-flex justify-content-evenly align-items-center '
export const qs = (s) => document.querySelector(s)

const App = () => {
    const { state, dispatch, update } = useContext(appStore);

    const onMount = () => {
        dispatch(onAppMount());
    };
    useEffect(onMount, []);

    window.onerror = function (message, url, lineNo) {
        alert('Error: ' + message + 
       '\nUrl: ' + url + 
       '\nLine Number: ' + lineNo);
    return true;   
    }
    
    const {
        accountData, funding, wallet
    } = state
    
    let children = null

    if (!accountData || !wallet) {
        children = <CircularProgress />
    }

    if (accountData) {
        children = <Receiver {...{ state, dispatch }} />
    }

    if (funding) {
        children = <div class="container container-custom">
            <h2>DO NOT CLOSE OR REFRESH THIS PAGE</h2>
            <h2>Creating Persona...</h2>
        </div>
    }

    if (wallet) {
        children = <Giver {...{ state, dispatch, update }} />
    }
    
    return <Container state={state}>{ children }</Container>
}

export default App;
