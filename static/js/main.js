document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // STATE & CONTEXT VARIABLES
    // ==========================================
    let currentVideoData = null;
    let selectedFormatId = null;
    let selectedFormatType = 'video';
    let selectedExt = 'mp4';
    
    let currentPlaylistData = null;
    
    let appSettings = {
        save_path: '',
        theme: 'dark',
        max_concurrent: 2,
        default_format: 'video_high',
        auto_update: true
    };
    
    let isFFmpegInstalled = true;
    let queuePollInterval = null;
    let activePollingRate = 1000; // 1s when downloading
    let idlePollingRate = 3000;   // 3s when idle
    let isQueueActive = false;

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const body = document.getElementById('app-body');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');
    
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('youtube-url');
    const pasteBtn = document.getElementById('paste-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const analyzeBtnText = analyzeBtn.querySelector('.btn-text');
    const analyzeSpinner = analyzeBtn.querySelector('.spinner');
    
    const queueCountSpan = document.getElementById('queue-count');
    const queueEmptyState = document.getElementById('queue-empty');
    const queueListDiv = document.getElementById('queue-list');
    const openFolderBtn = document.getElementById('open-folder-btn');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    
    // Modals
    const formatModal = document.getElementById('format-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalThumbnail = document.getElementById('modal-thumbnail');
    const modalVideoTitle = document.getElementById('modal-video-title');
    const modalVideoChannel = document.getElementById('modal-video-channel');
    const modalVideoDuration = document.getElementById('modal-video-duration');
    const videoOptionsList = document.getElementById('video-options-list');
    const audioOptionsList = document.getElementById('audio-options-list');
    const addToQueueBtn = document.getElementById('add-to-queue-btn');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    const playlistModal = document.getElementById('playlist-modal');
    const closePlaylistBtn = document.getElementById('close-playlist-btn');
    const playlistTitle = document.getElementById('playlist-title');
    const playlistVideoCount = document.getElementById('playlist-video-count');
    const playlistItemsList = document.getElementById('playlist-items-list');
    const playlistSelectAll = document.getElementById('playlist-select-all');
    const playlistDefaultFormat = document.getElementById('playlist-default-format');
    const selectedPlaylistCount = document.getElementById('selected-playlist-count');
    const addPlaylistBtn = document.getElementById('add-playlist-btn');
    
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const savePathInput = document.getElementById('save-path-input');
    const changePathBtn = document.getElementById('change-path-btn');
    const maxConcurrentSelect = document.getElementById('max-concurrent-select');
    const defaultFormatSelect = document.getElementById('default-format-select');
    const updateYtdlpBtn = document.getElementById('update-ytdlp-btn');
    const updateYtdlpSpinner = updateYtdlpBtn.querySelector('.spinner');
    const ffmpegStatusText = document.getElementById('ffmpeg-status-text');
    const ffmpegWarningBadge = document.getElementById('ffmpeg-warning');
    const ffmpegInstallGuide = document.getElementById('ffmpeg-install-guide');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    
    const toastContainer = document.getElementById('toast-container');

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = '';
        if (type === 'success') icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        else if (type === 'error') icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        else if (type === 'warning') icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        else icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        
        toast.innerHTML = `
            ${icon}
            <div class="toast-message">${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Remove toast after animation
        setTimeout(() => {
            toast.style.animation = 'toast-enter 0.3s reverse forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    // ==========================================
    // THEME HANDLING
    // ==========================================
    function setTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            body.classList.remove('dark-mode');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            body.classList.add('dark-mode');
            body.classList.remove('light-mode');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
        appSettings.theme = theme;
    }
    
    themeToggleBtn.addEventListener('click', () => {
        const nextTheme = body.classList.contains('light-mode') ? 'dark' : 'light';
        setTheme(nextTheme);
        // Save theme setting to backend
        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: nextTheme })
        }).catch(err => console.error("Theme save error", err));
    });

    // ==========================================
    // CLIPBOARD PASTE
    // ==========================================
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && (text.includes('youtube.com') || text.includes('youtu.be'))) {
                urlInput.value = text;
                showToast('유튜브 주소를 붙여넣었습니다.', 'success');
            } else {
                showToast('클립보드에 올바른 유튜브 주소가 없습니다.', 'warning');
            }
        } catch (err) {
            // Permission denied or not supported, user can still manually paste
            showToast('클립보드 읽기 권한이 필요하거나 지원하지 않는 브라우저입니다.', 'warning');
        }
    });

    // ==========================================
    // FFMPEG DETECTION
    // ==========================================
    function checkFFmpegStatus() {
        fetch('/api/check-ffmpeg')
            .then(res => res.json())
            .then(data => {
                isFFmpegInstalled = data.ffmpeg_installed;
                if (!isFFmpegInstalled) {
                    ffmpegWarningBadge.classList.remove('hidden');
                    ffmpegStatusText.textContent = '미설치';
                    ffmpegStatusText.className = 'status-indicator danger';
                    ffmpegInstallGuide.classList.remove('hidden');
                } else {
                    ffmpegWarningBadge.classList.add('hidden');
                    ffmpegStatusText.textContent = '설치됨';
                    ffmpegStatusText.className = 'status-indicator success';
                    ffmpegInstallGuide.classList.add('hidden');
                }
            })
            .catch(err => console.error("FFmpeg check error:", err));
    }
    
    ffmpegWarningBadge.addEventListener('click', () => {
        openSettingsModal();
    });

    // ==========================================
    // INITIALIZATION & SETTINGS
    // ==========================================
    function loadAppSettings() {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                appSettings = data;
                setTheme(appSettings.theme);
                savePathInput.value = appSettings.save_path;
                maxConcurrentSelect.value = appSettings.max_concurrent;
                defaultFormatSelect.value = appSettings.default_format;
            })
            .catch(err => console.error("Settings load error:", err));
    }

    // ==========================================
    // SETTINGS MODAL
    // ==========================================
    function openSettingsModal() {
        checkFFmpegStatus();
        settingsModal.classList.remove('hidden');
    }
    
    openSettingsBtn.addEventListener('click', openSettingsModal);
    
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
    
    // Close on overlay click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    changePathBtn.addEventListener('click', () => {
        fetch('/api/settings/select-folder', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    savePathInput.value = data.path;
                    showToast('저장 폴더가 선택되었습니다.', 'success');
                } else if (data.message) {
                    showToast(data.message, 'info');
                } else if (data.error) {
                    showToast(`폴더 선택 오류: ${data.error}`, 'error');
                }
            })
            .catch(err => console.error("Select folder error:", err));
    });

    updateYtdlpBtn.addEventListener('click', () => {
        updateYtdlpBtn.disabled = true;
        updateYtdlpSpinner.classList.remove('hidden');
        showToast('yt-dlp 버퍼 엔진을 업데이트 중입니다...', 'info');
        
        fetch('/api/update-ytdlp', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                updateYtdlpBtn.disabled = false;
                updateYtdlpSpinner.classList.add('hidden');
                if (data.success) {
                    showToast(data.message, 'success');
                } else {
                    showToast(data.message || '업데이트에 실패했습니다.', 'error');
                }
            })
            .catch(err => {
                updateYtdlpBtn.disabled = false;
                updateYtdlpSpinner.classList.add('hidden');
                showToast('엔진 업데이트 중 네트워크 오류 발생', 'error');
            });
    });

    saveSettingsBtn.addEventListener('click', () => {
        const updated = {
            save_path: savePathInput.value,
            max_concurrent: parseInt(maxConcurrentSelect.value),
            default_format: defaultFormatSelect.value
        };
        
        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    appSettings = data.settings;
                    showToast('설정이 성공적으로 저장되었습니다.', 'success');
                    settingsModal.classList.add('hidden');
                } else {
                    showToast('설정 저장 실패', 'error');
                }
            })
            .catch(err => {
                showToast('네트워크 오류로 설정 저장 실패', 'error');
            });
    });

    // ==========================================
    // ANALYSIS & ADD ACTIONS
    // ==========================================
    urlForm.addEventListener('submit', () => {
        const url = urlInput.value.trim();
        if (!url) return;
        
        analyzeBtn.disabled = true;
        analyzeSpinner.classList.remove('hidden');
        analyzeBtnText.textContent = '분석 중...';
        
        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        })
            .then(res => res.json())
            .then(data => {
                analyzeBtn.disabled = false;
                analyzeSpinner.classList.add('hidden');
                analyzeBtnText.textContent = '분석 및 추가';
                
                if (data.error) {
                    showToast(data.error, 'error', 4500);
                    return;
                }
                
                if (data.is_playlist) {
                    openPlaylistModal(data);
                } else {
                    openFormatModal(data);
                }
                urlInput.value = ''; // Reset input on success
            })
            .catch(err => {
                analyzeBtn.disabled = false;
                analyzeSpinner.classList.add('hidden');
                analyzeBtnText.textContent = '분석 및 추가';
                showToast('동영상 분석 도중 오류가 발생했습니다. 주소를 다시 확인해주세요.', 'error');
                console.error("Analysis error:", err);
            });
    });

    // ==========================================
    // FORMAT MODAL HANDLING
    // ==========================================
    function openFormatModal(videoData) {
        currentVideoData = videoData;
        modalThumbnail.src = videoData.thumbnail;
        modalVideoTitle.textContent = videoData.title;
        modalVideoChannel.textContent = videoData.channel;
        modalVideoDuration.textContent = `재생시간: ${videoData.duration_str}`;
        
        // Reset tabs
        tabButtons[0].classList.add('active');
        tabButtons[1].classList.remove('active');
        tabPanes[0].classList.add('active');
        tabPanes[1].classList.remove('active');
        
        // Clear lists
        videoOptionsList.innerHTML = '';
        audioOptionsList.innerHTML = '';
        
        // Generate Video Formats
        if (videoData.video_formats.length === 0) {
            videoOptionsList.innerHTML = '<div class="empty-state-text">가능한 비디오 포맷이 없습니다.</div>';
        } else {
            videoData.video_formats.forEach((fmt, index) => {
                const opt = document.createElement('div');
                // Select first option by default, or auto choose based on settings
                const isSelected = index === 0;
                opt.className = `format-option ${isSelected ? 'selected' : ''}`;
                opt.dataset.id = fmt.format_id;
                opt.dataset.ext = fmt.ext;
                opt.dataset.type = 'video';
                
                if (isSelected) {
                    selectedFormatId = fmt.format_id;
                    selectedFormatType = 'video';
                    selectedExt = fmt.ext;
                }
                
                // Add warnings if user has no ffmpeg and resolution > 720p
                const requiresFfmpeg = fmt.height > 720;
                const warningText = (!isFFmpegInstalled && requiresFfmpeg) 
                    ? '<span class="option-sub danger">⚠️ FFmpeg 필요 (720p로 자동 제한됨)</span>' 
                    : '';
                
                opt.innerHTML = `
                    <div class="option-left">
                        <div class="radio-circle"></div>
                        <div class="option-details">
                            <span class="option-title">${fmt.resolution} (${fmt.fps}fps)</span>
                            <span class="option-sub">${fmt.ext.toUpperCase()} 파일 포맷 ${warningText}</span>
                        </div>
                    </div>
                    <span class="option-size">${fmt.filesize_str}</span>
                `;
                
                opt.addEventListener('click', () => {
                    document.querySelectorAll('#video-options-list .format-option').forEach(el => el.classList.remove('selected'));
                    opt.classList.add('selected');
                    selectedFormatId = fmt.format_id;
                    selectedFormatType = 'video';
                    selectedExt = fmt.ext;
                });
                
                videoOptionsList.appendChild(opt);
            });
        }
        
        // Generate Audio Formats
        videoData.audio_formats.forEach((fmt, index) => {
            const opt = document.createElement('div');
            opt.className = `format-option`;
            opt.dataset.id = fmt.format_id;
            opt.dataset.ext = fmt.ext;
            opt.dataset.type = 'audio';
            
            const warningText = !isFFmpegInstalled 
                ? '<span class="option-sub danger">⚠️ FFmpeg 미설치로 변환 제한될 수 있음</span>' 
                : '';
                
            opt.innerHTML = `
                <div class="option-left">
                    <div class="radio-circle"></div>
                    <div class="option-details">
                        <span class="option-title">${fmt.quality}</span>
                        <span class="option-sub">${fmt.ext.toUpperCase()} 오디오 파일 ${warningText}</span>
                    </div>
                </div>
                <span class="option-size">${fmt.filesize_str}</span>
            `;
            
            opt.addEventListener('click', () => {
                document.querySelectorAll('.format-option').forEach(el => el.classList.remove('selected'));
                opt.classList.add('selected');
                selectedFormatId = fmt.format_id;
                selectedFormatType = 'audio';
                selectedExt = fmt.ext;
            });
            
            audioOptionsList.appendChild(opt);
        });
        
        formatModal.classList.remove('hidden');
    }
    
    // Tab switching in Format modal
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(tabId).classList.add('active');
            
            // Auto select first option in active tab
            const firstOpt = document.querySelector(`#${tabId} .format-option`);
            if (firstOpt) {
                firstOpt.click();
            }
        });
    });

    closeModalBtn.addEventListener('click', () => {
        formatModal.classList.add('hidden');
    });
    
    formatModal.addEventListener('click', (e) => {
        if (e.target === formatModal) formatModal.classList.add('hidden');
    });

    // Add analyzed video to download queue
    addToQueueBtn.addEventListener('click', () => {
        if (!currentVideoData || !selectedFormatId) return;
        
        const payload = {
            url: currentVideoData.url,
            title: currentVideoData.title,
            thumbnail: currentVideoData.thumbnail,
            duration_str: currentVideoData.duration_str,
            format_id: selectedFormatId,
            format_type: selectedFormatType,
            ext: selectedExt
        };
        
        fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    showToast(`추가 오류: ${data.error}`, 'error');
                } else {
                    showToast(data.message, 'success');
                    formatModal.classList.add('hidden');
                    refreshQueue();
                }
            })
            .catch(err => {
                showToast('네트워크 오류로 대기열 추가 실패', 'error');
            });
    });

    // ==========================================
    // PLAYLIST MODAL HANDLING
    // ==========================================
    function openPlaylistModal(playlistData) {
        currentPlaylistData = playlistData;
        playlistTitle.textContent = playlistData.title;
        playlistVideoCount.textContent = playlistData.count;
        
        playlistItemsList.innerHTML = '';
        playlistData.entries.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'playlist-item-row';
            row.innerHTML = `
                <label class="checkbox-container">
                    <input type="checkbox" class="playlist-item-check" data-url="${entry.url}" data-title="${entry.title}" checked>
                    <span class="checkmark"></span>
                    <span class="playlist-item-title" title="${entry.title}">${entry.title}</span>
                </label>
            `;
            playlistItemsList.appendChild(row);
        });
        
        updateSelectedPlaylistCount();
        
        // Add event listeners to checkboxes
        document.querySelectorAll('.playlist-item-check').forEach(chk => {
            chk.addEventListener('change', updateSelectedPlaylistCount);
        });
        
        playlistModal.classList.remove('hidden');
    }

    function updateSelectedPlaylistCount() {
        const checkedCount = document.querySelectorAll('.playlist-item-check:checked').length;
        selectedPlaylistCount.textContent = checkedCount;
        playlistSelectAll.checked = checkedCount === currentPlaylistData.entries.length;
    }

    playlistSelectAll.addEventListener('change', () => {
        const isChecked = playlistSelectAll.checked;
        document.querySelectorAll('.playlist-item-check').forEach(chk => {
            chk.checked = isChecked;
        });
        updateSelectedPlaylistCount();
    });

    closePlaylistBtn.addEventListener('click', () => {
        playlistModal.classList.add('hidden');
    });

    playlistModal.addEventListener('click', (e) => {
        if (e.target === playlistModal) playlistModal.classList.add('hidden');
    });

    addPlaylistBtn.addEventListener('click', async () => {
        const checkedItems = document.querySelectorAll('.playlist-item-check:checked');
        if (checkedItems.length === 0) {
            showToast('다운로드할 항목을 최소 하나 이상 선택하세요.', 'warning');
            return;
        }
        
        const formatSetting = playlistDefaultFormat.value;
        let fmtId = 'best';
        let fmtType = 'video';
        let extension = 'mp4';
        
        if (formatSetting === 'bestaudio_mp3') {
            fmtId = 'bestaudio';
            fmtType = 'audio';
            extension = 'mp3';
        }
        
        showToast(`${checkedItems.length}개의 항목을 대기열에 추가하는 중...`, 'info');
        playlistModal.classList.add('hidden');
        
        // Add each checked item to queue
        for (const chk of checkedItems) {
            const url = chk.dataset.url;
            const title = chk.dataset.title;
            
            const payload = {
                url: url,
                title: title,
                thumbnail: '', // Let backend or yt-dlp fetch thumbnail later if needed
                duration_str: '00:00',
                format_id: fmtId,
                format_type: fmtType,
                ext: extension
            };
            
            try {
                await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                console.error("Queue add failed for", title, err);
            }
        }
        
        showToast('선택한 항목들이 모두 대기열에 추가되었습니다.', 'success');
        refreshQueue();
    });

    // ==========================================
    // QUEUE POLLING & MANAGEMENT
    // ==========================================
    function refreshQueue() {
        fetch('/api/queue')
            .then(res => res.json())
            .then(data => {
                const queue = data.queue || [];
                updateQueueUI(queue);
                
                // Decide polling rate
                const hasActiveDownloads = queue.some(item => item.status === 'downloading' || item.status === 'queued');
                if (hasActiveDownloads) {
                    if (!isQueueActive || activePollingRate !== activePollingRate) {
                        isQueueActive = true;
                        startPolling(activePollingRate);
                    }
                } else {
                    if (isQueueActive) {
                        isQueueActive = false;
                        startPolling(idlePollingRate);
                    }
                }
            })
            .catch(err => console.error("Queue fetch error:", err));
    }

    function updateQueueUI(queue) {
        queueCountSpan.textContent = queue.length;
        
        if (queue.length === 0) {
            queueEmptyState.classList.remove('hidden');
            queueListDiv.classList.add('hidden');
            return;
        }
        
        queueEmptyState.classList.add('hidden');
        queueListDiv.classList.remove('hidden');
        
        // Render queue list efficiently by matching/updating elements
        const currentElements = Array.from(queueListDiv.children);
        const currentIds = currentElements.map(el => el.dataset.id);
        const newIds = queue.map(item => item.id);
        
        // Remove old elements that are no longer in queue
        currentElements.forEach(el => {
            if (!newIds.includes(el.dataset.id)) {
                el.remove();
            }
        });
        
        queue.forEach((item, index) => {
            let el = document.querySelector(`.queue-item[data-id="${item.id}"]`);
            const isNew = !el;
            
            if (isNew) {
                el = document.createElement('div');
                el.className = `queue-item status-${item.status}`;
                el.dataset.id = item.id;
            } else {
                // Update classes
                el.className = `queue-item status-${item.status}`;
            }
            
            // Format control buttons based on state
            let controlsHtml = '';
            if (item.status === 'downloading') {
                controlsHtml = `
                    <button class="control-btn btn-pause" data-action="pause" title="일시정지">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="0"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    </button>
                    <button class="control-btn btn-cancel" data-action="cancel" title="취소">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="0"><rect x="4" y="4" width="16" height="16"></rect></svg>
                    </button>
                `;
            } else if (item.status === 'paused') {
                controlsHtml = `
                    <button class="control-btn btn-resume" data-action="resume" title="재개">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="0"><polygon points="8 5 8 19 19 12 8 5"></polygon></svg>
                    </button>
                    <button class="control-btn btn-cancel" data-action="cancel" title="취소">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" stroke-width="0"><rect x="4" y="4" width="16" height="16"></rect></svg>
                    </button>
                `;
            } else {
                // Queued, Completed, Failed, Canceled
                controlsHtml = `
                    <button class="control-btn btn-delete" data-action="delete" title="지우기">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                `;
            }
            
            // Status text mapped to Korean
            let statusText = '대기 중';
            let statusClass = 'status-text-queued';
            if (item.status === 'downloading') {
                statusText = '다운로드 중';
                statusClass = 'status-text-downloading';
            } else if (item.status === 'paused') {
                statusText = '일시 중지됨';
                statusClass = 'status-text-paused';
            } else if (item.status === 'completed') {
                statusText = '다운로드 완료';
                statusClass = 'status-text-completed';
            } else if (item.status === 'failed') {
                statusText = '다운로드 실패';
                statusClass = 'status-text-failed';
            } else if (item.status === 'canceled') {
                statusText = '취소됨';
                statusClass = 'status-text-failed';
            }
            
            const errorHtml = item.error_message ? `<div class="item-error-msg" title="${item.error_message}">오류: ${item.error_message}</div>` : '';
            const sizeProgressText = item.status === 'completed' ? item.size : `${item.progress.toFixed(1)}% of ${item.size}`;
            
            // Build card inner HTML
            el.innerHTML = `
                <div class="item-thumbnail-wrapper">
                    <img src="${item.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 60%22><rect width=%22100%22 height=%2260%22 fill=%22%23334155%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2212%22>YOUTUBE</text></svg>'}" alt="Thumbnail" class="item-thumbnail">
                    <span class="item-duration">${item.duration_str}</span>
                </div>
                
                <div class="item-info">
                    <div class="item-title" title="${item.title}">${item.title}</div>
                    <div class="item-meta">
                        <span class="item-ext">${item.ext}</span>
                        <span class="item-status-text ${statusClass}">${statusText}</span>
                    </div>
                    
                    <div class="item-progress-container">
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${item.progress}%"></div>
                        </div>
                        <div class="item-progress-details">
                            <span>${sizeProgressText}</span>
                            <div class="item-speed-eta">
                                <span class="item-speed">${item.speed}</span>
                                <span class="item-eta">${item.eta}</span>
                            </div>
                        </div>
                    </div>
                    ${errorHtml}
                </div>
                
                <div class="item-controls">
                    ${controlsHtml}
                </div>
            `;
            
            // Bind action click listeners
            el.querySelectorAll('.control-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = btn.dataset.action;
                    controlDownload(item.id, action);
                });
            });
            
            if (isNew) {
                // Ensure proper order
                if (index === 0) {
                    queueListDiv.prepend(el);
                } else {
                    queueListDiv.appendChild(el);
                }
            }
        });
    }

    function controlDownload(id, action) {
        fetch('/api/queue/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, action: action })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast(data.message, 'success');
                    refreshQueue();
                } else {
                    showToast(data.error || '동작을 실행할 수 없습니다.', 'error');
                }
            })
            .catch(err => {
                console.error("Control error:", err);
                showToast('네트워크 통신 오류 발생', 'error');
            });
    }

    // Open Save Folder
    openFolderBtn.addEventListener('click', () => {
        fetch('/api/settings/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: appSettings.save_path })
        })
            .then(res => res.json())
            .then(data => {
                if (!data.success) {
                    showToast(`폴더 열기 실패: ${data.error}`, 'error');
                }
            })
            .catch(err => console.error("Open folder error:", err));
    });

    // Clear completed history
    clearCompletedBtn.addEventListener('click', () => {
        controlDownload(null, 'clear_completed');
    });

    // ==========================================
    // POLLING ENGINE
    // ==========================================
    function startPolling(rate) {
        if (queuePollInterval) {
            clearInterval(queuePollInterval);
        }
        queuePollInterval = setInterval(refreshQueue, rate);
    }

    // ==========================================
    // BOOTSTRAP
    // ==========================================
    loadAppSettings();
    checkFFmpegStatus();
    
    // Initial fetch and start idle polling
    refreshQueue();
    startPolling(idlePollingRate);
});
