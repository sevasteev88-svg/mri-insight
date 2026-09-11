import React from 'react';
export default function TI({ name, size = 14, color }) {
  return <i className={`ti ${name}`} style={{ fontSize: size, color, lineHeight: 1 }} aria-hidden="true" />;
}
