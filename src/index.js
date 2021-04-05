import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { AppProvider } from './state/app.js';

let test = process.env.CODE
console.log('teset', test)

ReactDOM.render(
	<AppProvider>
		<App />
	</AppProvider>,
	document.getElementById('root')
);
