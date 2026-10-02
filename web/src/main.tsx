import React from 'react';
import {createRoot} from 'react-dom/client';
// Cinzel 5.2.4 exports weight paths without a .css suffix.
import '@fontsource/cinzel/500';
import '@fontsource/cinzel/600';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles.css';
import './stone-shell.css';
import './season-gate.css';
import './league-entry.css';
import './stone-content.css';
import './emperors-favor.css';
import './statistics-experience.css';
import './statistics-dashboard.css';
import './statistics-hall.css';
import './statistics-hall-v2.css';
import './statistics-hall-v3.css';
import './statistics-hall-v4.css';
import './statistics-hall-v5.css';
import './statistics-background-reset.css';
import './statistics-hall-v6.css';
import './statistics-hall-v7.css';
import './statistics-hall-v8.css';
import './statistics-hall-v9.css';
import './statistics-hall-v10.css';
import './statistics-hall-v11.css';
import './statistics-hall-v12.css';
import './statistics-hall-v13.css';
import './statistics-hall-v14.css';
import './statistics-runtime-fixes';
import './player-profile-refinement.css';
import './relationship-chronicle.css';
import {App} from './ui/App';
import {PreviewLeagueRepository} from './data/PreviewLeagueRepository';
import type {LeagueRepository} from './domain/league';

async function start(){
  const requestedMode=String(import.meta.env.VITE_AOF_REPOSITORY_MODE??'').trim().toLowerCase();
  if(requestedMode&&!['preview','firebase'].includes(requestedMode)){
    throw new Error("VITE_AOF_REPOSITORY_MODE must be 'preview' or 'firebase'.");
  }

  const config=[import.meta.env.VITE_FIREBASE_API_KEY,import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,import.meta.env.VITE_FIREBASE_APP_ID];
  const firebaseConfigured=config.every(Boolean)&&!!import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if(requestedMode!=='preview'&&config.some(Boolean)&&!firebaseConfigured){
    throw new Error('Firebase configuration is incomplete.');
  }

  let repository:LeagueRepository;
  if(requestedMode==='preview'){
    repository=new PreviewLeagueRepository();
  }else if(requestedMode==='firebase'){
    if(!firebaseConfigured)throw new Error("Firebase repository mode requires the complete VITE_FIREBASE_* configuration.");
    repository=new (await import('./data/FirebaseLeagueRepository')).FirebaseLeagueRepository();
  }else{
    repository=firebaseConfigured
      ?new (await import('./data/FirebaseLeagueRepository')).FirebaseLeagueRepository()
      :new PreviewLeagueRepository();
  }

  createRoot(document.getElementById('root')!).render(<React.StrictMode><App repository={repository}/></React.StrictMode>);
}
start().catch(error=>{
  const message=document.createElement('p');message.className='fatal';
  message.textContent='Age of Friends could not start. '+(error instanceof Error?error.message:'Please reload.');
  document.getElementById('root')!.append(message);
});