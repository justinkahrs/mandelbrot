"use client";
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#9c27b0" }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*": { boxSizing: "border-box" },
        html: { width: "100%", height: "100%" },
        body: { width: "100%", height: "100%", margin: 0, padding: 0 },
        "#__next": { width: "100%", height: "100%" },
        canvas: { display: "block" }
      }
    }
  }
});

export default theme;