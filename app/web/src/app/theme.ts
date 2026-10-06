import { createTheme, type MantineColorsTuple } from '@mantine/core';

/** Dreamhouse brand green (#86BD4A — `<headerColor>` in Dreamhouse.app-meta.xml). */
const dreamhouseGreen: MantineColorsTuple = [
  '#f3f9ec',
  '#e5f0d8',
  '#cbe1ae',
  '#afd181',
  '#97c35b',
  '#86bd4a',
  '#7ab73f',
  '#68a032',
  '#5b8f2a',
  '#4c7b1f',
];

export const theme = createTheme({
  primaryColor: 'dreamhouse',
  primaryShade: 5,
  colors: { dreamhouse: dreamhouseGreen },
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
});
