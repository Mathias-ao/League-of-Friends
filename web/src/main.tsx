import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles.css';
import {App} from './ui/App';
import {PreviewLeagueRepository} from './data/PreviewLeagueRepository';
import type {LeagueRepository} from './domain/league';
async function start(){
  const config=[import.meta.env.VITE_FIREBASE_API_KEY,import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,import.meta.env.VITE_FIREBASE_APP_ID];
  if(config.some(Boolean)&&(!config.every(Boolean)||!import.meta.env.VITE_FIREBASE_PROJECT_ID))throw new Error('Firebase configuration is incomplete.');
  const repository:LeagueRepository=config.every(Boolean)?new (await import('./data/FirebaseLeagueRepository')).FirebaseLeagueRepository():new PreviewLeagueRepository();
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App repository={repository}/></React.StrictMode>);
}
start().catch(error=>{
  const message=document.createElement('p');message.className='fatal';
  message.textContent='Age of Friends could not start. '+(error instanceof Error?error.message:'Please reload.');
  document.getElementById('root')!.append(message);
});
