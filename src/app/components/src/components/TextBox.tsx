import React, { useState } from 'react';

interface TextBoxProps {
  onWordSelect: (word: string) => void;
  suggestions: string[];
}

const TextBox: React.FC<TextBoxProps> = ({ onWordSelect, suggestions }) => {
  const [typedText, setTypedText] = useState<string>('');

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTypedText(event.target.value);
  };

  const handleSuggestionClick = (word: string) => {
    setTypedText(word);
    onWordSelect(word);
  };

  return (
    <div style={{ position: 'relative', width: '80%', margin: '0 auto' }}>
      <textarea
        value={typedText}
        onChange={handleChange}
        style={{
          width: '100%',
          height: '100px',
          fontSize: '16px',
          padding: '10px',
          borderRadius: '5px',
          border: '1px solid black',
          resize: 'none',
        }}
      />
      {suggestions.length > 0 && (
        <ul style={{ listStyleType: 'none', padding: '0', margin: '5px 0' }}>
          {suggestions.map((word, index) => (
            <li
              key={index}
              onClick={() => handleSuggestionClick(word)}
              style={{
                cursor: 'pointer',
                padding: '5px',
                backgroundColor: 'lightgray',
                borderRadius: '3px',
                margin: '2px 0',
              }}
            >
              {word}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TextBox;