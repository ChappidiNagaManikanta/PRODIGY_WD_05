"# Weatherly

A responsive weather dashboard with current conditions, an hourly chart, and a
5-day forecast. Weather data is requested through a Netlify Function so the
OpenWeatherMap API key is not exposed in browser code.

## Deploying to Netlify

Set `OPENWEATHER_API_KEY` in the Netlify site's environment variables, then
redeploy. The function is served from `/.netlify/functions/weather`."
