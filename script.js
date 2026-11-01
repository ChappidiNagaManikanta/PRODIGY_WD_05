const defaultCity = 'London';
const chartMetrics = {
    temperature: {
        label: 'Temperature',
        color: '#ffd166',
        getValue: item => Math.round(item.main.temp),
        format: value => `${value}°`
    },
    humidity: {
        label: 'Humidity',
        color: '#79d4c3',
        getValue: item => item.main.humidity,
        format: value => `${value}%`
    },
    wind: {
        label: 'Wind',
        color: '#a99aff',
        getValue: item => Math.round(item.wind.speed * 3.6),
        format: value => `${value} km/h`
    }
};

let activeForecast = [];
let forecastTimezoneOffset = 0;

async function getWeather() {
    const cityInput = document.getElementById('city');
    const city = cityInput.value.trim();
    const errorDiv = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    const weatherLayout = document.getElementById('weather-layout');
    const submitButton = document.querySelector('.search-form button');

    errorDiv.textContent = '';
    if (!city) {
        errorDiv.textContent = 'Please enter a city.';
        return;
    }

    cityInput.value = city;
    emptyState.hidden = false;
    weatherLayout.hidden = true;
    submitButton.disabled = true;
    submitButton.querySelector('span').textContent = 'Loading...';

    const weatherUrl = `/.netlify/functions/weather?city=${encodeURIComponent(city)}`;

    try {
        const { currentWeather, forecast } = await fetchWeatherData(weatherUrl);
        activeForecast = forecast.list;
        forecastTimezoneOffset = forecast.city.timezone || 0;
        displayWeather(currentWeather, forecastTimezoneOffset);
        displayHourlyForecast(activeForecast);
        displayDailyForecast(activeForecast, forecastTimezoneOffset);
        renderHourlyChart('temperature');
        emptyState.hidden = true;
        weatherLayout.hidden = false;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        errorDiv.textContent = error.message || 'Unable to fetch weather data. Please try again.';
    } finally {
        submitButton.disabled = false;
        submitButton.querySelector('span').textContent = 'Get forecast';
    }
}

async function fetchWeatherData(url) {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `Weather request failed (${response.status}).`);
    }

    return data;
}

function displayWeather(data, timezoneOffset) {
    const cityName = data.name;
    const country = data.sys.country;
    const location = country ? `${cityName}, ${country}` : cityName;
    const temperature = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const description = data.weather[0].description;
    const iconCode = data.weather[0].icon;

    document.getElementById('location-name').textContent = location;
    document.getElementById('local-date').textContent = formatCityDate(data.dt, timezoneOffset);
    document.getElementById('report-summary').textContent =
        `In ${location}, it is ${temperature}°C with ${description}. Expect ${data.main.humidity}% humidity and winds around ${Math.round(data.wind.speed * 3.6)} km/h.`;
    document.getElementById('weather-info').textContent = capitalize(description);
    document.getElementById('temp-div').textContent = `${temperature}°`;
    document.getElementById('humidity-value').textContent = `${data.main.humidity}%`;
    document.getElementById('wind-value').textContent = `${Math.round(data.wind.speed * 3.6)} km/h`;
    document.getElementById('feels-like-value').textContent = `${feelsLike}°C`;

    const weatherIcon = document.getElementById('weather-icon');
    weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    weatherIcon.alt = capitalize(description);
}

function displayHourlyForecast(hourlyData) {
    const hourlyForecastDiv = document.getElementById('hourly-forecast');
    const next24Hours = hourlyData.slice(0, 8);

    hourlyForecastDiv.replaceChildren(...next24Hours.map(item => {
        const hourlyItem = document.createElement('div');
        hourlyItem.className = 'hourly-item';

        const time = document.createElement('span');
        time.textContent = formatCityTime(item.dt, forecastTimezoneOffset);
        const icon = document.createElement('img');
        icon.src = `https://openweathermap.org/img/wn/${item.weather[0].icon}.png`;
        icon.alt = item.weather[0].description;
        const temperature = document.createElement('span');
        temperature.textContent = `${Math.round(item.main.temp)}°`;

        hourlyItem.append(time, icon, temperature);
        return hourlyItem;
    }));
}

function displayDailyForecast(forecastData, timezoneOffset) {
    const days = new Map();

    forecastData.forEach(item => {
        const localDate = cityDate(item.dt, timezoneOffset);
        const key = `${localDate.getUTCFullYear()}-${localDate.getUTCMonth()}-${localDate.getUTCDate()}`;
        if (!days.has(key)) {
            days.set(key, { date: localDate, entries: [] });
        }
        days.get(key).entries.push(item);
    });

    const dailyForecast = document.getElementById('daily-forecast');
    dailyForecast.replaceChildren(...[...days.values()].slice(0, 5).map((day, index) => {
        const high = Math.round(Math.max(...day.entries.map(item => item.main.temp_max)));
        const low = Math.round(Math.min(...day.entries.map(item => item.main.temp_min)));
        const midday = day.entries.reduce((closest, item) => {
            const hour = cityDate(item.dt, timezoneOffset).getUTCHours();
            return Math.abs(hour - 12) < Math.abs(cityDate(closest.dt, timezoneOffset).getUTCHours() - 12) ? item : closest;
        }, day.entries[0]);
        const dateLabel = index === 0
            ? 'Today'
            : new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(day.date);

        const row = document.createElement('div');
        row.className = 'daily-item';
        const dayName = document.createElement('span');
        dayName.className = 'daily-name';
        dayName.textContent = dateLabel;
        const icon = document.createElement('img');
        icon.src = `https://openweathermap.org/img/wn/${midday.weather[0].icon}.png`;
        icon.alt = midday.weather[0].description;
        const condition = document.createElement('span');
        condition.className = 'daily-condition';
        condition.textContent = capitalize(midday.weather[0].description);
        const temperatures = document.createElement('span');
        temperatures.className = 'daily-temperatures';
        temperatures.innerHTML = `<strong>${high}°</strong><span>${low}°</span>`;
        row.append(dayName, icon, condition, temperatures);
        return row;
    }));
}

function renderHourlyChart(metricName) {
    const metric = chartMetrics[metricName];
    const chart = document.getElementById('hourly-chart');
    const items = activeForecast.slice(0, 8);
    const chartWidth = 760;
    const chartHeight = 220;
    const left = 28;
    const right = chartWidth - 20;
    const top = 40;
    const bottom = chartHeight - 38;
    const values = items.map(metric.getValue);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const spread = maximum - minimum || 1;
    const points = values.map((value, index) => ({
        x: left + (right - left) * index / Math.max(values.length - 1, 1),
        y: bottom - 12 - (value - minimum) / spread * (bottom - top - 24),
        value
    }));
    const linePath = points.map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    ).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;

    chart.replaceChildren();
    chart.setAttribute('aria-label', `${metric.label} forecast for the next 24 hours`);
    chart.style.setProperty('--chart-color', metric.color);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'chart-fill');
    gradient.setAttribute('x1', '0');
    gradient.setAttribute('x2', '0');
    gradient.setAttribute('y1', '0');
    gradient.setAttribute('y2', '1');
    const start = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    start.setAttribute('offset', '0%');
    start.setAttribute('stop-color', metric.color);
    start.setAttribute('stop-opacity', '0.25');
    const end = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    end.setAttribute('offset', '100%');
    end.setAttribute('stop-color', metric.color);
    end.setAttribute('stop-opacity', '0.015');
    gradient.append(start, end);
    defs.append(gradient);
    chart.append(defs);

    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', 'url(#chart-fill)');
    chart.append(area);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', metric.color);
    line.setAttribute('stroke-width', '3');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    chart.append(line);

    points.forEach((point, index) => {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', point.x);
        label.setAttribute('y', point.y - 13);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'chart-value');
        label.textContent = metric.format(point.value);
        chart.append(label);

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', point.x);
        dot.setAttribute('cy', point.y);
        dot.setAttribute('r', index === 0 ? '5' : '3.5');
        dot.setAttribute('class', 'chart-dot');
        chart.append(dot);
    });

}

function cityDate(timestamp, timezoneOffset) {
    return new Date((timestamp + timezoneOffset) * 1000);
}

function formatCityTime(timestamp, timezoneOffset) {
    return `${String(cityDate(timestamp, timezoneOffset).getUTCHours()).padStart(2, '0')}:00`;
}

function formatCityDate(timestamp, timezoneOffset) {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    }).format(cityDate(timestamp, timezoneOffset));
}

function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

document.querySelectorAll('.metric-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.metric-tab').forEach(item => {
            const isSelected = item === tab;
            item.classList.toggle('is-active', isSelected);
            item.setAttribute('aria-selected', String(isSelected));
        });
        renderHourlyChart(tab.dataset.metric);
    });
});

const cityInput = document.getElementById('city');
cityInput.value = defaultCity;
window.addEventListener('DOMContentLoaded', () => {
    getWeather();
});
