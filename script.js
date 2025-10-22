document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const appContainer = document.getElementById('app-container');
    const categoryNav = document.getElementById('category-nav');
    const searchInput = document.getElementById('search-input');
    const themeToggle = document.getElementById('theme-toggle');
    const fontIncrease = document.getElementById('font-increase');
    const fontDecrease = document.getElementById('font-decrease');
    const fontLevelDisplay = document.getElementById('font-level');
    const html = document.documentElement;

    // --- State ---
    let allData = [];
    let activeCategory = 'All';
    const FONT_LEVELS = [0.7, 0.8, 0.9, 0.95, 1, 1.1, 1.2, 1.3, 1.5, 1.7];
    let currentFontLevel = 4;
    const dataFiles = ['data_daily_life.json', 'data_travel.json', 'data_welcome.json'];

    // (★★ 追加 ★★) --- Audio Playback ---
    const AUDIO_FILES_PATH = 'mp3_all_phrases/';
    let currentAudio = null; // 現在再生中のAudioオブジェクトを管理
    let lastClickedButton = null; // ローディング表示を管理するボタン

    function playAudio(button, audioId) {
        // 他の音声が再生中、または同じボタンがローディング中の場合は停止
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            if (lastClickedButton) {
                lastClickedButton.classList.remove('is-loading');
            }
        }

        // 同じボタンを再度クリックした場合は再生を停止するだけ
        if (lastClickedButton === button) {
            currentAudio = null;
            lastClickedButton = null;
            return;
        }

        const audioSrc = `${AUDIO_FILES_PATH}${audioId}.mp3`;
        currentAudio = new Audio(audioSrc);
        lastClickedButton = button;
        
        button.classList.add('is-loading');

        // 再生準備ができたときの処理
        currentAudio.oncanplaythrough = () => {
            button.classList.remove('is-loading');
            currentAudio.play();
        };

        // 再生が終了したときの処理
        currentAudio.onended = () => {
            currentAudio = null;
            lastClickedButton = null;
        };

        // エラー処理
        currentAudio.onerror = () => {
            console.error(`Error loading audio file: ${audioSrc}`);
            button.classList.remove('is-loading');
            alert(`音声ファイル (${audioId}.mp3) の読み込みに失敗しました。ファイルが存在するか確認してください。`);
            currentAudio = null;
            lastClickedButton = null;
        };
    }

    // --- Data Fetching and Rendering ---
    async function fetchData() {
        try {
            const responses = await Promise.all(dataFiles.map(file => fetch(file)));
            for (const response of responses) {
                if (!response.ok) throw new Error(`Failed to load ${response.url}`);
            }
            const jsonDataArrays = await Promise.all(responses.map(res => res.json()));
            allData = jsonDataArrays.flat();
            setupCategoryNav();
            filterAndRender();
        } catch (error) {
            console.error('Fetch error:', error);
            appContainer.innerHTML = `<p>コンテンツの読み込みに失敗しました。ファイルが見つからないか、JSONの形式が正しくない可能性があります。</p>`;
        }
    }

    function setupCategoryNav() {
        const categories = ['All', ...new Set(allData.map(item => item.category))];
        const navInner = document.createElement('div');
        navInner.className = 'category-nav-inner';
        categories.forEach(cat => {
            const button = document.createElement('button');
            button.className = 'category-button';
            button.textContent = cat;
            button.dataset.category = cat;
            if (cat === activeCategory) button.classList.add('active');
            button.addEventListener('click', () => {
                activeCategory = cat;
                document.querySelectorAll('.category-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                filterAndRender();
            });
            navInner.appendChild(button);
        });
        categoryNav.innerHTML = '';
        categoryNav.appendChild(navInner);
    }

    function filterAndRender() {
        const searchTerm = searchInput.value.toLowerCase();
        let filteredData = allData;
        if (activeCategory !== 'All') {
            filteredData = filteredData.filter(item => item.category === activeCategory);
        }
        if (searchTerm.length > 0) {
            filteredData = filteredData.map(scene => {
                const filteredExpressions = scene.expressions.filter(exp => 
                    exp.english.toLowerCase().includes(searchTerm) ||
                    exp.japanese.toLowerCase().includes(searchTerm) ||
                    exp.explanation.toLowerCase().includes(searchTerm) ||
                    (exp.responses && exp.responses.some(r => r.english.toLowerCase().includes(searchTerm) || r.japanese.toLowerCase().includes(searchTerm)))
                );
                return { ...scene, expressions: filteredExpressions };
            }).filter(scene => scene.expressions.length > 0);
        }
        renderContent(filteredData);
    }
    
    // (★★ 更新 ★★) data-idを追加
    function renderResponses(responses, expId) {
        if (!responses || responses.length === 0) return '';
        return `
            <button class="responses-toggle-button" data-target="responses-${expId}">返答例を見る</button>
            <div class="responses-container" id="responses-${expId}">
                ${responses.map((res, index) => {
                    const responseJpId = `res-jp-${expId}-${index}`;
                    const responseAudioId = `${expId}_resp${index + 1}`; // 応答文の音声IDを生成
                    return `
                        <div class="response-item">
                            <div class="response-item-main">
                                <p class="response-item-en" data-target="${responseJpId}">${res.english}</p>
                                <button class="action-button audio-button" data-id="${responseAudioId}">🔊</button>
                            </div>
                            <p class="response-item-jp" id="${responseJpId}">${res.japanese}</p>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // (★★ 更新 ★★) data-idを追加
    function renderContent(data) {
        if (data.length === 0) {
            appContainer.innerHTML = '<p>該当するフレーズが見つかりません。</p>';
            return;
        }
        appContainer.innerHTML = data.map(scene => `
            <div class="scene-card">
                <h2 class="scene-title">${scene.scene}</h2>
                ${scene.expressions.map(exp => `
                    <div class="expression" id="exp-${exp.id}">
                        <div class="expression-main">
                            <p class="expression-en" data-target="jp-${exp.id}">${exp.english}</p>
                            <div class="expression-actions">
                                <button class="action-button audio-button" data-id="${exp.id}">🔊 音声</button>
                                <button class="action-button desc-button" data-target="desc-${exp.id}">📝 解説</button>
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

    // (★★ 更新 ★★) クリックイベントの処理を更新
    appContainer.addEventListener('click', e => {
        const target = e.target.closest('button.action-button, p.expression-en, p.response-item-en, button.responses-toggle-button');
        if (!target) return; // 関係ない場所のクリックは無視

        if (target.matches('p.expression-en, p.response-item-en')) {
            document.getElementById(target.dataset.target)?.classList.toggle('is-visible');
        } 
        else if (target.matches('.desc-button')) {
            document.getElementById(target.dataset.target)?.classList.toggle('is-visible');
        } 
        else if (target.matches('.audio-button')) {
            playAudio(target, target.dataset.id); // 新しい再生関数を呼び出す
        } 
        else if (target.matches('.responses-toggle-button')) {
            const container = document.getElementById(target.dataset.target);
            if (container) {
                container.classList.toggle('is-visible');
                target.textContent = container.classList.contains('is-visible') ? '返答例を閉じる' : '返答例を見る';
            }
        }
    });

    // --- Other Event Listeners ---
    searchInput.addEventListener('input', filterAndRender);
    themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'dark' : 'light'));
    fontIncrease.addEventListener('click', () => applyFontSize(currentFontLevel + 1));
    fontDecrease.addEventListener('click', () => applyFontSize(currentFontLevel - 1));

    // --- Helper Functions ---
    function applyTheme(theme) {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        localStorage.setItem('theme', theme);
    }
    function applyFontSize(level) {
        currentFontLevel = Math.max(0, Math.min(FONT_LEVELS.length - 1, level));
        html.style.setProperty('--font-size-base', `${FONT_LEVELS[currentFontLevel]}rem`);
        fontLevelDisplay.textContent = currentFontLevel + 1;
        localStorage.setItem('fontLevel', currentFontLevel);
    }

    // (★★ 更新 ★★) Web Speech API関連を削除
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