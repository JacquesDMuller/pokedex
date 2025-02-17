const cache = {};
let currentChart = null;
const favorites = JSON.parse(localStorage.getItem('pokemonFavorites')) || [];
let battleMode = false;
let selectedPokemon = null;

document.addEventListener('DOMContentLoaded', () => {
    // Configuração do tema
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    // Event listener para o botão de tema
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    document.addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--x', `${x}px`);
            card.style.setProperty('--y', `${y}px`);
            
            const rotateX = (y / rect.height - 0.5) * 20;
            const rotateY = (x / rect.width - 0.5) * -20;
            card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
        });
    });

    document.addEventListener('mouseleave', () => {
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            card.style.transform = 'rotateX(0) rotateY(0) scale(1)';
        });
    });

    // Adicionar eventos para os inputs da batalha
    document.getElementById('pokemon1-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            buscarPokemonBatalha(1);
        }
    });

    document.getElementById('pokemon2-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            buscarPokemonBatalha(2);
        }
    });
});

async function buscarPokemon() {
    const input = document.getElementById('pokemon-input').value.toLowerCase().trim();
    const divInfo = document.getElementById('pokemon-info');
    const loading = document.getElementById('loading');

    if (!input) return;

    divInfo.classList.remove('visible');
    loading.classList.remove('hidden');

    try {
        if (currentChart) currentChart.destroy();

        if (cache[input]) {
            exibirPokemon(cache[input]);
            return;
        }

        const [pokemonRes, speciesRes] = await Promise.all([
            fetch(`https://pokeapi.co/api/v2/pokemon/${input}`),
            fetch(`https://pokeapi.co/api/v2/pokemon-species/${input}/`)
        ]);

        if (!pokemonRes.ok || !speciesRes.ok) throw new Error('Pokémon não encontrado!');

        const pokemon = await pokemonRes.json();
        const species = await speciesRes.json();
        const evolutionChain = await buscarEvolutionChain(species.evolution_chain.url);
        
        cache[input] = { ...pokemon, species, evolutionChain };
        exibirPokemon(cache[input]);

        const mainType = pokemon.types[0].type.name;
        document.documentElement.style.setProperty('--primary-color', getTypeColor(mainType));

    } catch (error) {
        divInfo.innerHTML = `<p class="error">${error.message}</p>`;
    } finally {
        loading.classList.add('hidden');
        divInfo.classList.add('visible');
    }
}

async function buscarEvolutionChain(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return processarEvolutionChain(data.chain);
    } catch (error) {
        console.error("Erro na cadeia de evolução:", error);
        return [];
    }
}

function processarEvolutionChain(chain) {
    const evolucoes = [];
    let current = chain;
    
    while (current) {
        evolucoes.push({
            nome: current.species.name,
            id: current.species.url.split('/')[6]
        });
        current = current.evolves_to[0];
    }
    return evolucoes;
}

function exibirPokemon(pokemon) {
    const divInfo = document.getElementById('pokemon-info');
    const isFavorite = favorites.includes(pokemon.name);
    
    divInfo.innerHTML = `
        <div class="card-container">
            <div class="card">
                <button class="favorite-button ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${pokemon.name}')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>
                <img src="${pokemon.sprites.other['official-artwork'].front_default}" 
                     alt="${pokemon.name}">
            </div>
        </div>

        <div class="pokemon-details">
            <div class="pokemon-info-section">
                <div class="pokemon-header">
                    <div class="pokemon-title">
                        <h2>${pokemon.name.toUpperCase()} #${pokemon.id}</h2>
                    </div>
                    <div class="pokemon-types">
                        ${pokemon.types.map(t => `
                            <span class="type-pill" style="background: ${getTypeColor(t.type.name)}">
                                ${t.type.name}
                            </span>
                        `).join('')}
                    </div>
                </div>
                
                <div class="pokemon-info-section">
                    <h3>Informações Básicas</h3>
                    <p><strong>Altura:</strong> ${pokemon.height / 10}m</p>
                    <p><strong>Peso:</strong> ${pokemon.weight / 10}kg</p>
                </div>

                <div class="pokemon-info-section">
                    <h3>Habilidades</h3>
                    <ul class="stats-list">
                        ${pokemon.abilities.map(a => `<li>${a.ability.name}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="pokemon-info-section">
                <h3>Status Base</h3>
                <canvas class="stats-chart" id="statsChart"></canvas>
            </div>

            <div class="pokemon-info-section">
                <h3>Cadeia de Evolução</h3>
                <div class="evolution-chain">
                    ${pokemon.evolutionChain.map(e => `
                        <div class="evolution-item">
                            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${e.id}.png" 
                                 onclick="buscarPokemonPorNome('${e.nome}')"
                                 width="80" alt="${e.nome}">
                            <span class="evolution-name">${e.nome}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <button class="sound-button" onclick="playPokemonCry('${pokemon.name}')">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1z"/>
                <path d="M16.5 12A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
        </button>
    `;

    const ctx = document.getElementById('statsChart').getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: pokemon.stats.map(s => s.stat.name),
            datasets: [{
                label: 'Status',
                data: pokemon.stats.map(s => s.base_stat),
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgb(255, 99, 132)'
            }]
        }
    });
}

function getTypeColor(type) {
    const typeColors = {
        fire: '#F08030', water: '#6890F0', grass: '#78C850',
        electric: '#F8D030', psychic: '#F85888', ice: '#98D8D8',
        dragon: '#7038F8', dark: '#705848', fairy: '#EE99AC',
        normal: '#A8A878', fighting: '#C03028', flying: '#A890F0',
        poison: '#A040A0', ground: '#E0C068', rock: '#B8A038',
        bug: '#A8B820', ghost: '#705898', steel: '#B8B8D0'
    };
    return typeColors[type] || '#68A090';
}

function toggleFavorite(pokemonName) {
    const index = favorites.indexOf(pokemonName);
    if (index === -1) {
        favorites.push(pokemonName);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('pokemonFavorites', JSON.stringify(favorites));
    
    // Atualiza o botão
    const button = document.querySelector('.favorite-button');
    button.classList.toggle('active');
}

async function buscarPokemonPorNome(nome) {
    document.getElementById('pokemon-input').value = nome;
    await buscarPokemon();
    // Scroll suave até o topo do card
    document.getElementById('pokemon-info').scrollIntoView({ behavior: 'smooth' });
}

function toggleBattleMode() {
    battleMode = !battleMode;
    const battleDiv = document.getElementById('battle-mode');
    const mainContent = document.getElementById('pokemon-info');
    
    if (battleMode) {
        // Exibe o modo batalha corretamente
        battleDiv.classList.add('active');
        battleDiv.classList.remove('hidden');
        mainContent.classList.add('hidden');
        
        // Limpar os campos e resultados anteriores
        document.getElementById('pokemon1-info').innerHTML = '';
        document.getElementById('pokemon2-info').innerHTML = '';
        document.getElementById('pokemon1-input').value = '';
        document.getElementById('pokemon2-input').value = '';
        selectedPokemon = null;
        
        // Remover classe winner se existir
        document.getElementById('pokemon1').classList.remove('winner');
        document.getElementById('pokemon2').classList.remove('winner');
    } else {
        // Desativa o modo batalha
        battleDiv.classList.remove('active');
        battleDiv.classList.add('hidden');
        mainContent.classList.remove('hidden');
    }
}

async function buscarPokemonBatalha(numero) {
    const input = document.getElementById(`pokemon${numero}-input`).value.toLowerCase().trim();
    const divInfo = document.getElementById(`pokemon${numero}-info`);
    
    if (!input) return;
    
    try {
        let pokemon;
        if (cache[input]) {
            pokemon = cache[input];
        } else {
            const [pokemonRes, speciesRes] = await Promise.all([
                fetch(`https://pokeapi.co/api/v2/pokemon/${input}`),
                fetch(`https://pokeapi.co/api/v2/pokemon-species/${input}/`)
            ]);

            if (!pokemonRes.ok || !speciesRes.ok) throw new Error('Pokémon não encontrado!');

            const pokemonData = await pokemonRes.json();
            const species = await speciesRes.json();
            const evolutionChain = await buscarEvolutionChain(species.evolution_chain.url);
            
            pokemon = { ...pokemonData, species, evolutionChain };
            cache[input] = pokemon;
        }

        exibirPokemonBatalha(pokemon, numero);

    } catch (error) {
        divInfo.innerHTML = `<p class="error">Pokémon não encontrado!</p>`;
    }
}

function exibirPokemonBatalha(pokemon, numero) {
    const div = document.getElementById(`pokemon${numero}-info`);
    
    div.innerHTML = `
        <div class="card-container">
            <div class="card">
                <img src="${pokemon.sprites.other['official-artwork'].front_default}" 
                     alt="${pokemon.name}">
                <button class="sound-button" onclick="playPokemonCry('${pokemon.name}')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1z"/>
                        <path d="M16.5 12A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                    </svg>
                </button>
            </div>
        </div>
        <h2>${pokemon.name.toUpperCase()}</h2>
    `;
    
    if (numero === 1) {
        selectedPokemon = pokemon;
    } else if (selectedPokemon) {
        compararStats(selectedPokemon, pokemon);
    }
}

function compararStats(pokemon1, pokemon2) {
    const stats1 = pokemon1.stats;
    const stats2 = pokemon2.stats;
    let pokemon1Total = 0;
    let pokemon2Total = 0;
    
    stats1.forEach((stat, index) => {
        pokemon1Total += stat.base_stat;
        pokemon2Total += stats2[index].base_stat;
        
        const maxStat = Math.max(stat.base_stat, stats2[index].base_stat);
        const width1 = (stat.base_stat / maxStat) * 100;
        const width2 = (stats2[index].base_stat / maxStat) * 100;
        
        const container1 = document.getElementById('pokemon1-info');
        const container2 = document.getElementById('pokemon2-info');
        
        container1.insertAdjacentHTML('beforeend', `
            <div class="stat-comparison">
                <span class="stat-name">${stat.stat.name}</span>
                <div class="stat-bar" style="width: ${width1}%; background: var(--primary-color)"></div>
                <span class="stat-value">${stat.base_stat}</span>
            </div>
        `);
        
        container2.insertAdjacentHTML('beforeend', `
            <div class="stat-comparison">
                <span class="stat-name">${stats2[index].stat.name}</span>
                <div class="stat-bar" style="width: ${width2}%; background: var(--primary-color)"></div>
                <span class="stat-value">${stats2[index].base_stat}</span>
            </div>
        `);
    });
    
    // Destacar o vencedor
    if (pokemon1Total > pokemon2Total) {
        document.getElementById('pokemon1').classList.add('winner');
    } else if (pokemon2Total > pokemon1Total) {
        document.getElementById('pokemon2').classList.add('winner');
    }
}

async function playPokemonCry(name) {
    try {
        // Primeiro, tenta buscar o ID do Pokémon se não estiver no cache
        let pokemon;
        if (cache[name]) {
            pokemon = cache[name];
        } else {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
            pokemon = await response.json();
        }
        
        // Usa o nome do Pokémon em minúsculo para a URL do som
        const audioUrl = `https://play.pokemonshowdown.com/audio/cries/${name.toLowerCase()}.mp3`;
        const audio = new Audio(audioUrl);
        
        // Adiciona tratamento de erro para o carregamento do áudio
        audio.onerror = () => {
            console.error('Erro ao carregar o som do Pokémon');
        };
        
        await audio.play();
    } catch (error) {
        console.error('Erro ao reproduzir o som:', error);
    }
}

function goToHomepage() {
    // Desativa o modo batalha se estiver ativo
    if (battleMode) {
        toggleBattleMode();
    }

    // Limpa qualquer pesquisa anterior
    document.getElementById('pokemon-input').value = '';
    document.getElementById('pokemon-info').innerHTML = '';
    document.getElementById('pokemon-info').classList.remove('visible');

    // Esconde qualquer mensagem de erro ou loading
    const loading = document.getElementById('loading');
    loading.classList.add('hidden');
}