import React from 'react';
import WordPredictor from './components/WordPredictor';
import './styles/global.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <h1>Gaze-Driven Word Predictor</h1>
      <WordPredictor />
    </div>
  );
};

export default App;