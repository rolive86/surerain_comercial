/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sr: {
          green: "#006A46",
          "green-dark": "#004D33",
          "green-light": "#0A8A5C",
          sand: "#F3F1EC",
          ink: "#14201A",
          mist: "#E7EEE9",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 12px 40px rgba(20, 32, 26, 0.08)",
      },
    },
  },
  plugins: [],
};
