import React, { useState, useEffect } from 'react';
import TextBox from './TextBox';
import { getSuggestions } from '../services/predictionService';

const WordPredictor: React.FC = () => {
  const [typedText, setTypedText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (typedText) {
      const fetchedSuggestions = getSuggestions(typedText);
      setSuggestions(fetchedSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [typedText]);

  const handleTextChange = (text: string) => {
    setTypedText(text);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setTypedText(suggestion);
    setSuggestions([]);
  };

  return (
    <div>
      <TextBox 
        typedText={typedText} 
        onTextChange={handleTextChange} 
        suggestions={suggestions} 
        onSuggestionSelect={handleSuggestionSelect} 
      />
    </div>
  );
};

export default WordPredictor;