const apiBaseUrl = 'https://api.openweathermap.org/data/2.5';

exports.handler = async event => {
    const city = event.queryStringParameters?.city?.trim();
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!city) {
        return jsonResponse(400, { message: 'Please enter a city.' });
    }

    if (!apiKey) {
        console.error('OPENWEATHER_API_KEY is not configured.');
        return jsonResponse(500, { message: 'Weather service is not configured yet.' });
    }

    try {
        const query = `q=${encodeURIComponent(city)}&units=metric&appid=${encodeURIComponent(apiKey)}`;
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`${apiBaseUrl}/weather?${query}`),
            fetch(`${apiBaseUrl}/forecast?${query}`)
        ]);
        const [currentWeather, forecast] = await Promise.all([
            currentResponse.json(),
            forecastResponse.json()
        ]);

        if (!currentResponse.ok || !forecastResponse.ok) {
            const failedResponse = !currentResponse.ok ? currentResponse : forecastResponse;
            const failedData = !currentResponse.ok ? currentWeather : forecast;
            return jsonResponse(failedResponse.status, {
                message: failedData.message || 'Weather request failed.'
            });
        }

        return jsonResponse(200, { currentWeather, forecast });
    } catch (error) {
        console.error('Unable to fetch weather data:', error);
        return jsonResponse(502, { message: 'Unable to reach the weather service. Please try again.' });
    }
};

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}
