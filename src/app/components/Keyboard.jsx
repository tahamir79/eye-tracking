import React from 'react';

export default function Keyboard({ hoveredKey, getKeyRef, setHoveredKey, getKeyStyle }) {
  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(14, 1fr)',
          gridGap: '0px',
          maxWidth: '1400px',
          margin: '0 auto',
          marginBottom: '10px',
        }}
      >
        {'1234567890-='.split('').map((key) => (
          <div
            key={key}
            data-value={key}
            ref={getKeyRef(key)}
            style={getKeyStyle(hoveredKey, key)}
          >
            {key}
          </div>
        ))}
        <div
          data-value="Backspace"
          ref={getKeyRef('Backspace')}
          style={getKeyStyle(hoveredKey, 'Backspace')}
        >
          Backspace
        </div>

        <div style={{ gridColumn: 'span 1' }}></div>
        {'QWERTYUIOP[]\\'.split('').map((key) => (
          <div
            key={key}
            data-value={key}
            ref={key === '\\' ? getKeyRef(key) : null}
            style={getKeyStyle(hoveredKey, key)}
          >
            {key}
          </div>
        ))}

        <div style={{ gridColumn: 'span 1' }}></div>
        {'ASDFGHJKL;\'"'.split('').map((key) => (
          <div key={key} data-value={key} style={getKeyStyle(hoveredKey, key)}>
            {key}
          </div>
        ))}
        <div
          data-value="Enter"
          ref={getKeyRef('Enter')}
          style={getKeyStyle(hoveredKey, 'Enter')}
        >
          Enter
        </div>

        <div
          data-value="Shift"
          ref={getKeyRef('Shift')}
          style={getKeyStyle(hoveredKey, 'Shift')}
        >
          Shift
        </div>
        {'ZXCVBNM,./'.split('').map((key) => (
          <div
            key={key}
            data-value={key}
            ref={key.toLowerCase() === 'z' ? getKeyRef(key) : null}
            style={getKeyStyle(hoveredKey, key)}
          >
            {key}
          </div>
        ))}
      </div>
      <div
        id="space-bar"
        data-value="Space"
        ref={getKeyRef('Space')}
        style={{
          gridColumn: 'span 14',
          backgroundColor: hoveredKey === 'Space' ? '#d3d3d3' : 'white',
          borderRadius: '5px',
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          boxShadow: hoveredKey === 'Space' ? '0px 4px 10px rgba(0, 0, 0, 0.1)' : 'none',
          margin: '0 auto',
          width: '100%',
        }}
      >
        Space
      </div>
    </>
  );
}