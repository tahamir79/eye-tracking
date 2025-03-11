import React from 'react';

export default function TextBox({ typedText, isShiftActive }) {
  return (
    <div
      style={{
        position: 'relative',
        top: '10px',
        width: '80%',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: '24px',
          backgroundColor: 'white',
          padding: '10px',
          flex: 1,
          borderRadius: '5px',
          textAlign: 'left',
          border: '1px solid black',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
        }}
      >
        {typedText}
        <span
          style={{
            display: 'inline-block',
            width: '1ch',
            backgroundColor: 'black',
            marginLeft: '5px',
            animation: 'blink 1s step-start infinite',
          }}
        >
          &nbsp;
        </span>
      </div>
      {isShiftActive && (
        <div
          style={{
            marginLeft: '10px',
            color: 'red',
            fontWeight: 'bold',
          }}
        >
          Shift key is active
        </div>
      )}
    </div>
  );
}