document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const appContainer = document.getElementById('app-container');
    const categoryNav = document.getElementById('category-nav');
    const searchInput = document.getElementById('search-input');
    const shortcutBar = document.getElementById('scene-shortcut-bar');
    const contentDisplayArea = document.getElementById('content-display-area');
    const themeToggle = document.getElementById('theme-toggle');
    const fontIncrease = document.getElementById('font-increase');
    const fontDecrease = document.getElementById('font-decrease');
    const fontLevelDisplay = document.getElementById('font-level');
    const html = document.documentElement;

    // --- State ---
    let allData = [];
    let activeCategory = null;
    let activeScene = null;
    let navData = {};
    const FONT_LEVELS = [0.7, 0.8, 0.9, 0.95, 1, 1.1, 1.2, 1.3, 1.5, 1.7];
    let currentFontLevel = 4;
    const dataFiles = ['data_daily_life.json', 'data_travel.json', 'data_welcome.json'];
    
    // --- Audio Playback ---
    const AUDIO_FILES_PATH = 'mp3_all_phrases/';
    let currentAudio = null;
    let lastClickedButton = null;

    function playAudio(button, audioId) {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            if (lastClickedButton) lastClickedButton.classList.remove('is-loading');
        }
        if (lastClickedButton === button) {
            currentAudio = null;
            lastClickedButton = null;
            return;
        }
        const audioSrc = `${AUDIO_FILES_PATH}${audioId}.mp3`;
        currentAudio = new Audio(audioSrc);
        lastClickedButton = button;
        button.classList.add('is-loading');
        currentAudio.oncanplaythrough = () => { button.classList.remove('is-loading'); currentAudio.play(); };
        currentAudio.onended = () => { currentAudio = null; lastClickedButton = null; };
        currentAudio.onerror = () => {
            console.error(`Error loading audio file: ${audioSrc}`);
            button.classList.remove('is-loading');
            alert(`音声ファイル (${audioId}.mp3) の読み込みに失敗しました。ファイルが存在するか確認してください。`);
            currentAudio = null;
            lastClickedButton = null;
        };
    }

    // --- Data Fetching and Initialization ---
    async function fetchData() {
        try {
            const responses = await Promise.all(dataFiles.map(file => fetch(file)));
            for (const response of responses) { if (!response.ok) throw new Error(`Failed to load ${response.url}`); }
            const jsonDataArrays = await Promise.all(responses.map(res => res.json()));
            allData = jsonDataArrays.flat();
            
            navData = allData.reduce((acc, scene) => {
                if (!acc[scene.category]) acc[scene.category] = [];
                const shortName = scene.scene.split(': ')[1]?.split(' (')[0] || scene.scene;
                acc[scene.category].push({ shortName, fullName: scene.scene });
                return acc;
            }, {});

            const savedCategory = localStorage.getItem('activeCategory');
            const savedScene = localStorage.getItem('activeScene');
            if (savedCategory && allData.some(d => d.category === savedCategory)) {
                activeCategory = savedCategory;
                activeScene = savedScene && savedScene !== 'null' ? savedScene : null;
            } else if (allData.length > 0) {
                activeCategory = allData[0].category;
                activeScene = null;
            }

            setupCategoryNav();
            filterAndRender();
        } catch (error) {
            console.error('Fetch error:', error);
            contentDisplayArea.innerHTML = `<p class="error-message">コンテンツの読み込みに失敗しました。ページを再読み込みしてください。</p>`;
        }
    }

    // --- Navigation Setup ---
    function setupCategoryNav() {
        const navInner = document.createElement('div');
        navInner.className = 'category-nav-inner';
        for (const category in navData) {
            const scenes = navData[category];
            if (scenes.length > 1) {
                const title = document.createElement('p');
                title.className = 'nav-category-title';
                title.textContent = category;
                navInner.appendChild(title);
                scenes.forEach(scene => {
                    const button = document.createElement('button');
                    button.className = 'nav-subcategory-button';
                    button.textContent = scene.shortName;
                    button.dataset.scene = scene.fullName;
                    button.dataset.parentCategory = category;
                    navInner.appendChild(button);
                });
            } else {
                const button = document.createElement('button');
                button.className = 'nav-category-button';
                button.textContent = category;
                button.dataset.category = category;
                navInner.appendChild(button);
            }
        }
        categoryNav.innerHTML = '';
        categoryNav.appendChild(navInner);

        categoryNav.addEventListener('click', e => {
            const target = e.target;
            if (target.matches('.nav-category-button')) {
                activeCategory = target.dataset.category;
                activeScene = null;
            } else if (target.matches('.nav-subcategory-button')) {
                activeCategory = target.dataset.parentCategory;
                activeScene = target.dataset.scene;
            } else {
                return;
            }
            localStorage.setItem('activeCategory', activeCategory);
            localStorage.setItem('activeScene', activeScene || '');
            filterAndRender();
        });
    }

    // --- Main Rendering Logic ---
    function filterAndRender() {
        appContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const searchTerm = searchInput.value.toLowerCase();
        let filteredData = allData;
        if (activeCategory) filteredData = filteredData.filter(item => item.category === activeCategory);
        
        renderShortcutBar(filteredData);

        if (activeScene) filteredData = filteredData.filter(item => item.scene === activeScene);
        if (searchTerm.length > 0) {
            filteredData = filteredData.map(scene => {
                const filteredExpressions = scene.expressions.filter(exp => 
                    exp.english.toLowerCase().includes(searchTerm) || exp.japanese.toLowerCase().includes(searchTerm) || exp.explanation.toLowerCase().includes(searchTerm) ||
                    (exp.responses && exp.responses.some(r => r.english.toLowerCase().includes(searchTerm) || r.japanese.toLowerCase().includes(searchTerm)))
                );
                return { ...scene, expressions: filteredExpressions };
            }).filter(scene => scene.expressions.length > 0);
        }
        
        updateNavActiveState();
        renderContent(filteredData, searchTerm);
    }
    
    function renderShortcutBar(categoryData) {
        const scenesInCategory = [...new Set(categoryData.map(d => d.scene))];
        if (scenesInCategory.length <= 1) {
            shortcutBar.innerHTML = '';
            shortcutBar.style.display = 'none';
            return;
        }

        shortcutBar.style.display = 'flex';
        let buttonsHTML = `<button class="shortcut-button ${!activeScene ? 'active' : ''}" data-scene="all">All ${activeCategory}</button>`;
        
        scenesInCategory.forEach(sceneFullName => {
            const shortName = sceneFullName.split(': ')[1]?.split(' (')[0] || sceneFullName;
            buttonsHTML += `<button class="shortcut-button ${activeScene === sceneFullName ? 'active' : ''}" data-scene="${sceneFullName}">${shortName}</button>`;
        });
        shortcutBar.innerHTML = buttonsHTML;
    }

    function updateNavActiveState() {
        document.querySelectorAll('#category-nav button').forEach(el => el.classList.remove('active'));
        if (activeScene) {
            const activeSubButton = document.querySelector(`.nav-subcategory-button[data-scene="${activeScene}"]`);
            if (activeSubButton) activeSubButton.classList.add('active');
        } else if (activeCategory) {
            const activeMainButton = document.querySelector(`.nav-category-button[data-category="${activeCategory}"]`);
            if (activeMainButton) activeMainButton.classList.add('active');
        }
    }
    
    function renderContent(data, searchTerm) {
        if (data.length === 0) {
            let message = '<div class="empty-state"><p>該当するフレーズが見つかりません。</p>';
            if(searchTerm && searchTerm.length > 0) {
                message += '<button class="clear-search-button">検索をクリア</button>';
            }
            message += '</div>';
            contentDisplayArea.innerHTML = message;
            const clearButton = contentDisplayArea.querySelector('.clear-search-button');
            if(clearButton) {
                clearButton.addEventListener('click', () => { searchInput.value = ''; filterAndRender(); });
            }
            return;
        }
        contentDisplayArea.innerHTML = data.map(scene => `
            <div class="scene-card" id="${scene.scene.replace(/[^a-zA-Z0-9]/g, '')}">
                <h2 class="scene-title">${scene.scene}</h2>
                ${scene.expressions.map(exp => `
                    <div class="expression" id="exp-${exp.id}">
                        <div class="expression-main">
                            <p class="expression-en" data-target="jp-${exp.id}">${exp.english}</p>
                            <div class="expression-actions">
                                <button class="action-button audio-button" data-id="${exp.id}">🔊</button>
                                <button class="action-button desc-button" data-target="desc-${exp.id}">📝</button>
                            </div>
                        </div>
                        <p class="expression-jp" id="jp-${exp.id}">${exp.japanese}</p>
                        <div class="expression-desc" id="desc-${exp.id}">${exp.explanation}</div>
                        ${renderResponses(exp.responses, exp.id)}
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    function renderResponses(responses, expId) {
        if (!responses || responses.length === 0) return '';
        return `
            <button class="responses-toggle-button" data-target="responses-${expId}">返答例を見る</button>
            <div class="responses-container" id="responses-${expId}">
                ${responses.map((res, index) => {
                    const responseJpId = `res-jp-${expId}-${index}`; const responseAudioId = `${expId}_resp${index + 1}`;
                    return `<div class="response-item"><div class="response-item-main"><p class="response-item-en" data-target="${responseJpId}">${res.english}</p><button class="action-button audio-button" data-id="${responseAudioId}">🔊</button></div><p class="response-item-jp" id="${responseJpId}">${res.japanese}</p></div>`;
                }).join('')}
            </div>
        `;
    }

    // --- Event Listeners ---
    shortcutBar.addEventListener('click', e => {
        if (e.target.matches('.shortcut-button')) {
            const sceneName = e.target.dataset.scene;
            if (sceneName === 'all') {
                activeScene = null;
                localStorage.setItem('activeScene', '');
                filterAndRender();
            } else {
                const targetCard = document.getElementById(sceneName.replace(/[^a-zA-Z0-9]/g, ''));
                if (targetCard) {
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }
    });

    appContainer.addEventListener('click', e => {
        const target = e.target.closest('button.action-button, p.expression-en, p.response-item-en, button.responses-toggle-button');
        if (!target) return;
        if (target.matches('p.expression-en, p.response-item-en')) { document.getElementById(target.dataset.target)?.classList.toggle('is-visible'); }
        else if (target.matches('.desc-button')) { document.getElementById(target.dataset.target)?.classList.toggle('is-visible'); }
        else if (target.matches('.audio-button')) { playAudio(target, target.dataset.id); }
        else if (target.matches('.responses-toggle-button')) {
            const container = document.getElementById(target.dataset.target);
            if (container) { container.classList.toggle('is-visible'); target.textContent = container.classList.contains('is-visible') ? '返答例を閉じる' : '返答例を見る'; }
        }
    });

    searchInput.addEventListener('input', () => {
        activeScene = null;
        filterAndRender();
    });
    
    themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light'));
    fontIncrease.addEventListener('click', () => applyFontSize(currentFontLevel + 1));
    fontDecrease.addEventListener('click', () => applyFontSize(currentFontLevel - 1));

    // --- Helper Functions ---
    function applyTheme(theme) { document.body.classList.toggle('dark-mode', theme === 'dark'); localStorage.setItem('theme', theme); }
    function applyFontSize(level) {
        currentFontLevel = Math.max(0, Math.min(FONT_LEVELS.length - 1, level));
        html.style.setProperty('--font-size-base', `${FONT_LEVELS[currentFontLevel]}rem`);
        fontLevelDisplay.textContent = currentFontLevel + 1;
        localStorage.setItem('fontLevel', currentFontLevel);
    }

    function initialize() {
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(savedTheme);
        themeToggle.checked = (savedTheme === 'dark');
        const savedFontLevel = localStorage.getItem('fontLevel');
        applyFontSize(savedFontLevel ? parseInt(savedFontLevel, 10) : 4);
        fetchData();
        if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(err => console.error('SW registration failed:', err));
    }

    initialize();
});