const SUPABASE_URL = 'https://yixpxokoinvmphgvdsee.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpeHB4b2tvaW52bXBoZ3Zkc2VlIiwicm9sZSI6InlpeHB4b2tvaW52bXBoZ3Zkc2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjEyMTgsImV4cCI6MjEwNTMzNzIxOH0.vwtkVEbxr5yzd5GNF4PBZlvRZIvVrFGQoh5EfNPpojE';

let _supabase = null;
try {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
        global: { headers: { 'x-client-info': 'event-kremlin' } }
    });
} catch(e) { console.error("Supabase init error", e); }

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    const timeline = document.getElementById('projects-timeline');

    const PREDEFINED_TEAM = [
        "Зломанов Олег Викторович",
        "Дубовой Андрей Николаевич",
        "Дубовой Алексей Николаевич",
        "Смутный Богдан Сергеевич"
    ];

    let activeProjects = [];
    let selectedProjectId = null;
    let isEditMode = false;
    let currentDashFilter = 'Все проекты'; 

    const updateAppBtn = document.getElementById('update-app-btn');
    if (updateAppBtn) {
        updateAppBtn.addEventListener('click', async () => {
            const icon = document.getElementById('sync-icon');
            icon.classList.add('animate-spin', 'text-sky-400');
            try {
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (let registration of registrations) { await registration.update(); }
                }
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                setTimeout(() => { window.location.reload(true); }, 800);
            } catch(err) { window.location.reload(true); }
        });
    }

    const modal = document.getElementById('date-modal');
    const dynamicDatesList = document.getElementById('dynamic-dates-list');
    const teamSelectionList = document.getElementById('team-selection-list');
    
    const titleInput = document.getElementById('new-project-title');
    const contractorInput = document.getElementById('new-project-contractor');
    const addressInput = document.getElementById('new-project-address');
    const metroInput = document.getElementById('new-project-metro');
    const costInput = document.getElementById('new-project-cost');
    const methodInput = document.getElementById('new-project-method');
    const modalTitle = document.getElementById('modal-title');
    
    const dashTotal = document.getElementById('dash-total');
    const dashPaid = document.getElementById('dash-paid');
    const dashPending = document.getElementById('dash-pending');

    const dropdownBtn = document.getElementById('custom-dropdown-btn');
    const dropdownMenu = document.getElementById('custom-dropdown-menu');
    const currentFilterText = document.getElementById('current-filter-text');
    const dropdownArrow = document.getElementById('dropdown-arrow');
    const filterIcon = document.getElementById('filter-icon');

    const savedData = localStorage.getItem('amProdData');
    if (savedData) {
        try {
            activeProjects = JSON.parse(savedData);
            if (activeProjects.length > 0) selectedProjectId = activeProjects[0].id;
        } catch(e) { console.error(e); }
    }
    
    renderDashboardFilters();
    renderTimeline();
    if (selectedProjectId) updateContentArea();
    updateDashboard();

    // Экспорт (скачать базу проектов в JSON)
    const exportBtn = document.getElementById('export-backup-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (activeProjects.length === 0) {
                alert('Нет проектов для экспорта!');
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeProjects, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `event_kremlin_backup_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        });
    }

    // Импорт (загрузить базу проектов из JSON)
    const importInput = document.getElementById('import-backup-input');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedProjects = JSON.parse(event.target.result);
                    if (Array.isArray(importedProjects)) {
                        activeProjects = importedProjects;
                        if (activeProjects.length > 0) selectedProjectId = activeProjects[0].id;
                        
                        // Синхронизируем с localStorage и облаком
                        localStorage.setItem('amProdData', JSON.stringify(activeProjects));
                        if (_supabase) {
                            for (const proj of activeProjects) {
                                await _supabase.from('am_projects').upsert({ id: proj.id, project_data: proj });
                            }
                        }

                        renderDashboardFilters();
                        renderTimeline();
                        if (selectedProjectId) updateContentArea();
                        updateDashboard();
                        alert(`Успешно загружено проектов: ${activeProjects.length}`);
                    } else {
                        alert('Ошибка: неверный формат файла бэкапа.');
                    }
                } catch (err) {
                    alert('Ошибка при чтении файла бэкапа.');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // Кнопка отправки общей сводки по всем проектам
    const shareAllBtn = document.getElementById('share-all-projects-btn');
    if (shareAllBtn) {
        shareAllBtn.addEventListener('click', async () => {
            if (activeProjects.length === 0) {
                alert('Нет активных проектов для отправки!');
                return;
            }

            let summaryText = `📋 *ОБЩАЯ СВОДКА ПО ПРОЕКТАМ* 📋\n\n`;
            let totalAllSum = 0;

            activeProjects.forEach((proj, idx) => {
                summaryText += `${idx + 1}. *${proj.title}*\n`;
                if (proj.contractor) summaryText += `   🏢 Контрагент: ${proj.contractor}\n`;
                if (proj.address) summaryText += `   📍 Площадка: ${proj.address}\n`;
                
                if (proj.dates && proj.dates.length > 0) {
                    summaryText += `   📅 Даты: `;
                    const dateStrs = proj.dates.map(d => {
                        const formatted = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(d.date));
                        return `${formatted} (${d.start || '09:00'}-${d.end || '23:00'})`;
                    });
                    summaryText += `${dateStrs.join(', ')}\n`;
                }

                summaryText += `   💰 Смета: ${proj.cost ? proj.cost.toLocaleString('ru-RU') : 0} ₽ (${proj.isPaid ? '✅ Оплачено' : '⏳ Ожидается'})\n\n`;
                totalAllSum += proj.cost || 0;
            });

            summaryText += `💎 *Общая сумма по всем проектам:* ${totalAllSum.toLocaleString('ru-RU')} ₽`;

            if (navigator.share) {
                try {
                    await navigator.share({ title: 'Сводка по всем проектам', text: summaryText });
                } catch (err) {}
            } else {
                navigator.clipboard.writeText(summaryText);
                alert('Общая сводка по всем проектам скопирована в буфер обмена!');
            }
        });
    }

    function scheduleProjectReminders() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        activeProjects.forEach(project => {
            if (!project.dates || project.dates.length === 0) return;
            const eventDate = new Date(project.dates[0].date);
            const reminderTime = new Date(eventDate.getTime() - (24 * 60 * 60 * 1000));
            const now = new Date();
            const timeDiff = reminderTime.getTime() - now.getTime();
            if (timeDiff > 0 && timeDiff < 30 * 24 * 60 * 60 * 1000) {
                setTimeout(() => {
                    new Notification("📅 Напоминание о проекте", {
                        body: `Завтра (${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(eventDate)}) состоится проект: "${project.title}"`,
                        icon: "./icon.jpg"
                    });
                }, timeDiff);
            }
        });
    }
    scheduleProjectReminders();

    document.querySelectorAll('.venue-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const addr = btn.getAttribute('data-address');
            const metro = btn.getAttribute('data-metro');
            if (addressInput) addressInput.value = addr;
            if (metroInput) metroInput.value = metro;
            btn.classList.add('bg-sky-600', 'text-white');
            setTimeout(() => { btn.classList.remove('bg-sky-600', 'text-white'); }, 300);
        });
    });

    async function fetchFromCloud() {
        if (!_supabase) return;
        try {
            const { data, error } = await _supabase.from('am_projects').select('*');
            if (data && !error && data.length > 0) {
                activeProjects = data.map(d => d.project_data);
                activeProjects.sort((a, b) => new Date(a.dates[0].date) - new Date(b.dates[0].date));
                if(activeProjects.length > 0 && !selectedProjectId) selectedProjectId = activeProjects[0].id;
                localStorage.setItem('amProdData', JSON.stringify(activeProjects));
                renderDashboardFilters();
                renderTimeline();
                if(selectedProjectId) updateContentArea();
                updateDashboard();
                scheduleProjectReminders();
            }
        } catch (e) {}
    }
    setTimeout(fetchFromCloud, 1000);

    if (_supabase) {
        try {
            _supabase.channel('public:am_projects')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'am_projects' }, () => { fetchFromCloud(); })
                .subscribe();
        } catch (e) {}
    }

    async function syncData(projectToUpsert = null, idToDelete = null) {
        localStorage.setItem('amProdData', JSON.stringify(activeProjects));
        renderDashboardFilters();
        updateDashboard();
        scheduleProjectReminders();
        if (!_supabase) return;
        try {
            if (idToDelete) await _supabase.from('am_projects').delete().eq('id', idToDelete);
            if (projectToUpsert) await _supabase.from('am_projects').upsert({ id: projectToUpsert.id, project_data: projectToUpsert });
        } catch (e) {}
    }

    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
        dropdownArrow.classList.toggle('rotate-180');
    });

    document.addEventListener('click', () => {
        dropdownMenu.classList.add('hidden');
        dropdownArrow.classList.remove('rotate-180');
    });

    function renderDashboardFilters() {
        dropdownMenu.innerHTML = '';
        const filters = ['Все проекты', 'Весь ФОТ', ...PREDEFINED_TEAM];
        activeProjects.forEach(p => {
            (p.team || []).forEach(m => { if (!filters.includes(m.name)) filters.push(m.name); });
        });

        filters.forEach(f => {
            const item = document.createElement('div');
            const isSelected = currentDashFilter === f;
            item.className = `px-4 py-3 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-between ${isSelected ? 'bg-sky-600/30 text-sky-400' : 'text-gray-300 hover:bg-gray-800'}`;
            item.innerHTML = `<span>${f}</span> ${isSelected ? '<i data-lucide="check" class="w-4 h-4"></i>' : ''}`;
            item.addEventListener('click', () => {
                currentDashFilter = f;
                currentFilterText.textContent = f;
                dropdownMenu.classList.add('hidden');
                dropdownArrow.classList.remove('rotate-180');
                updateDashboard();
                renderDashboardFilters();
            });
            dropdownMenu.appendChild(item);
        });
        lucide.createIcons({root: dropdownMenu});
        currentFilterText.textContent = currentDashFilter;
    }

    function updateDashboard() {
        let total = 0, paid = 0, pending = 0;
        activeProjects.forEach(p => {
            if (currentDashFilter === 'Все проекты') {
                total += p.cost || 0;
                if (p.isPaid) paid += p.cost || 0; else pending += p.cost || 0;
            } else if (currentDashFilter === 'Весь ФОТ') {
                let projectFot = 0;
                p.team.forEach(m => projectFot += m.fee);
                total += projectFot;
                if (p.isPaid) paid += projectFot; else pending += projectFot;
            } else {
                const member = (p.team || []).find(m => m.name === currentDashFilter);
                if (member) {
                    total += member.fee || 0;
                    if (p.isPaid) paid += member.fee || 0; else pending += member.fee || 0;
                }
            }
        });
        dashTotal.textContent = `${total.toLocaleString('ru-RU')} ₽`;
        dashPaid.textContent = `${paid.toLocaleString('ru-RU')} ₽`;
        dashPending.textContent = `${pending.toLocaleString('ru-RU')} ₽`;
    }

    const openModal = (editMode = false) => {
        isEditMode = editMode;
        modalTitle.textContent = editMode ? 'Изменить проект' : 'Новый проект';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    const closeModal = () => { modal.classList.remove('flex'); modal.classList.add('hidden'); };

    document.getElementById('add-date-btn').addEventListener('click', () => {
        titleInput.value = ''; contractorInput.value = ''; addressInput.value = ''; metroInput.value = '';
        costInput.value = '15000'; methodInput.value = 'Наличные';
        dynamicDatesList.innerHTML = '';
        addDateRow('', '09:00', '23:00');
        renderTeamSelection([]);
        openModal(false);
    });
    
    document.getElementById('cancel-date').addEventListener('click', closeModal);

    const detailsModal = document.getElementById('details-modal');
    document.getElementById('open-details-modal-btn').addEventListener('click', () => {
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (project) {
            document.getElementById('details-modal-title').textContent = project.title;
            renderCheckinSection(project);
            renderTransportSection(project);
        }
        detailsModal.classList.remove('hidden');
        detailsModal.classList.add('flex');
    });

    document.getElementById('close-details-modal').addEventListener('click', () => {
        detailsModal.classList.remove('flex');
        detailsModal.classList.add('hidden');
    });

    document.getElementById('get-location-btn').addEventListener('click', () => {
        const btn = document.getElementById('get-location-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>`;
        lucide.createIcons({root: btn});
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&accept-language=ru`);
                    const data = await res.json();
                    if(data && data.address) {
                        addressInput.value = `${data.address.city || ''}, ${data.address.road || ''} ${data.address.house_number || ''}`.trim();
                    }
                } catch(e) { alert('Не удалось получить адрес'); }
                btn.innerHTML = originalHtml;
            }, () => { alert('Доступ к геолокации запрещен'); btn.innerHTML = originalHtml; });
        } else { btn.innerHTML = originalHtml; }
    });

    function addDateRow(dateVal='', startVal='09:00', endVal='23:00') {
        const row = document.createElement('div');
        row.className = "date-row flex gap-1 items-center";
        row.innerHTML = `
            <input type="date" class="row-date w-[43%] bg-gray-950 text-white text-xs rounded-xl p-2 outline-none border border-gray-700" style="color-scheme: dark;" value="${dateVal}" required>
            <input type="time" class="row-start w-[23%] bg-gray-950 text-sky-300 text-xs rounded-xl p-2 outline-none border border-sky-500/50" style="color-scheme: dark;" value="${startVal}">
            <span class="text-sky-400 text-xs font-bold">-</span>
            <input type="time" class="row-end w-[23%] bg-gray-950 text-sky-300 text-xs rounded-xl p-2 outline-none border border-sky-500/50" style="color-scheme: dark;" value="${endVal}">
            <button type="button" class="remove-row-btn w-[11%] text-red-500/80 hover:text-red-400 p-1 flex justify-center"><i data-lucide="x-circle" class="w-4 h-4"></i></button>
        `;
        dynamicDatesList.appendChild(row);
        lucide.createIcons({root: row});
        row.querySelector('.remove-row-btn').addEventListener('click', () => {
            if(dynamicDatesList.children.length > 1) row.remove(); else alert('Минимум один день!');
        });
    }
    document.getElementById('add-dynamic-date-btn').addEventListener('click', () => addDateRow('', '09:00', '23:00'));

    function renderTeamSelection(existingTeam = []) {
        teamSelectionList.innerHTML = '';
        PREDEFINED_TEAM.forEach(name => {
            const memberData = existingTeam.find(m => m.name === name) || { fee: 15000 };
            const isChecked = !!existingTeam.find(m => m.name === name);
            addTeamMemberRow(name, memberData.fee, isChecked, true);
        });
        existingTeam.forEach(member => {
            if (!PREDEFINED_TEAM.includes(member.name)) addTeamMemberRow(member.name, member.fee, true, false);
        });
        calcTeamTotal();
    }

    function addTeamMemberRow(name = '', fee = 15000, isChecked = false, isPredefined = false) {
        const row = document.createElement('div');
        row.className = "custom-team-row flex justify-between items-center bg-gray-950 p-2 rounded-xl border border-gray-700/80 gap-2";
        if (isPredefined) {
            row.innerHTML = `
                <label class="flex items-center gap-2 flex-1 cursor-pointer min-w-0 pr-2">
                    <input type="checkbox" class="team-checkbox shrink-0" value="${name}" ${isChecked ? 'checked' : ''}>
                    <span class="text-[11px] text-gray-300 font-medium truncate">${name}</span>
                </label>
                <input type="number" class="team-fee w-20 shrink-0 bg-gray-900 text-white text-xs rounded-xl p-1.5 outline-none border border-gray-600 focus:border-sky-500 text-right ${isChecked ? '' : 'opacity-30'}" value="${fee !== '' ? fee : 15000}" ${isChecked ? '' : 'disabled'}>`;
        } else {
            row.innerHTML = `
                <input type="checkbox" class="team-checkbox shrink-0 hidden" value="custom" checked>
                <input type="text" class="custom-team-name flex-1 bg-gray-900 text-white text-[11px] rounded-xl p-1.5 outline-none border border-gray-600 focus:border-purple-500" placeholder="ФИО или Роль" value="${name}">
                <input type="number" class="team-fee w-20 shrink-0 bg-gray-900 text-white text-xs rounded-xl p-1.5 outline-none border border-gray-600 focus:border-purple-500 text-right" value="${fee !== '' ? fee : 15000}">
                <button type="button" class="text-red-500/80 hover:text-red-400 p-1 flex justify-center w-6 shrink-0" onclick="this.parentElement.remove(); calcTeamTotal();"><i data-lucide="x" class="w-4 h-4"></i></button>`;
        }
        const checkbox = row.querySelector('.team-checkbox');
        const feeInput = row.querySelector('.team-fee');
        if(checkbox && isPredefined) {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    feeInput.disabled = false; feeInput.classList.remove('opacity-30');
                    if(!feeInput.value) feeInput.value = 15000; feeInput.focus();
                } else {
                    feeInput.disabled = true; feeInput.classList.add('opacity-30'); feeInput.value = '';
                }
                calcTeamTotal();
            });
        }
        if(feeInput) feeInput.addEventListener('input', calcTeamTotal);
        teamSelectionList.appendChild(row);
        lucide.createIcons({root: row});
    }

    document.getElementById('add-custom-member-btn').addEventListener('click', () => { addTeamMemberRow('', 15000, true, false); });

    function calcTeamTotal() {
        let total = 0;
        document.querySelectorAll('.custom-team-row').forEach(row => {
            const checkbox = row.querySelector('.team-checkbox');
            const feeInput = row.querySelector('.team-fee');
            if (checkbox && checkbox.checked && feeInput && feeInput.value) total += Number(feeInput.value);
        });
        document.getElementById('team-total-calc').textContent = total.toLocaleString('ru-RU');
        if (total > 0) document.getElementById('new-project-cost').value = total;
    }

    document.getElementById('save-date').addEventListener('click', () => {
        const dateRows = document.querySelectorAll('.date-row');
        const extractedDates = [];
        dateRows.forEach(row => {
            const dVal = row.querySelector('.row-date').value;
            if(dVal) extractedDates.push({ date: dVal, start: row.querySelector('.row-start').value, end: row.querySelector('.row-end').value });
        });
        if (extractedDates.length === 0) { alert('Укажите хотя бы одну дату!'); return; }
        extractedDates.sort((a,b) => new Date(a.date) - new Date(b.date));

        const extractedTeam = [];
        document.querySelectorAll('.custom-team-row').forEach(row => {
            const checkbox = row.querySelector('.team-checkbox');
            if (checkbox && checkbox.checked) {
                let memberName = checkbox.value;
                if(memberName === 'custom') {
                    const nameInput = row.querySelector('.custom-team-name');
                    memberName = nameInput ? nameInput.value.trim() : '';
                }
                const feeVal = row.querySelector('.team-fee').value;
                if (memberName) extractedTeam.push({ name: memberName, fee: feeVal ? Number(feeVal) : 15000 });
            }
        });

        const existingProj = activeProjects.find(p => p.id === selectedProjectId);
        
        const defaultTransport = [
            { model: "Автомобиль", number: "—", driver: "Семенов Иван", phone: "+79263451616" },
            { model: "Автомобиль", number: "—", driver: "Юра", phone: "+79166298513" }
        ];

        const projectData = {
            id: isEditMode ? selectedProjectId : Date.now().toString(),
            title: titleInput.value || 'Без названия',
            contractor: contractorInput.value || '',
            address: addressInput.value || '',
            metro: metroInput.value || '',
            dates: extractedDates,
            team: extractedTeam,
            cost: costInput.value ? Number(costInput.value) : 15000,
            method: methodInput.value || 'Наличные',
            isPaid: isEditMode ? existingProj.isPaid : false,
            checkinList: isEditMode && existingProj ? existingProj.checkinList : [],
            transportList: isEditMode && existingProj ? (existingProj.transportList.length > 0 ? existingProj.transportList : defaultTransport) : defaultTransport
        };

        const existingIndex = activeProjects.findIndex(proj => proj.id === projectData.id);
        if (existingIndex > -1) activeProjects[existingIndex] = projectData; else activeProjects.push(projectData);

        activeProjects.sort((a, b) => new Date(a.dates[0].date) - new Date(b.dates[0].date));
        selectedProjectId = projectData.id;
        
        syncData(projectData, null); 
        renderTimeline();
        updateContentArea();
        closeModal();
    });

    function renderTimeline() {
        timeline.innerHTML = '';
        if (activeProjects.length > 0) {
            document.getElementById('project-content').classList.remove('hidden');
            setTimeout(() => document.getElementById('project-content').classList.remove('opacity-0'), 50);
        } else {
            document.getElementById('project-content').classList.add('hidden', 'opacity-0');
            timeline.innerHTML = `<div class="col-span-4 text-center text-gray-500 text-sm py-4 border border-dashed border-gray-800 rounded-2xl">Нажмите +, чтобы добавить проект</div>`;
        }

        activeProjects.forEach(project => {
            const isActive = project.id === selectedProjectId;
            const icon = document.createElement('button');
            const firstDate = new Date(project.dates[0].date);
            const day = firstDate.getDate();
            const month = new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(firstDate).replace('.', '');
            const weekday = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(firstDate);
            const multiBadge = project.dates.length > 1 ? `<div class="absolute top-1 right-1 bg-sky-500 text-white text-[9px] font-bold px-1 rounded-full shadow">+${project.dates.length - 1}</div>` : '';

            const borderStyle = project.isPaid && !isActive ? 'border-green-500/40 text-green-400 bg-green-900/10' : 'border-white/10 text-gray-300 bg-gray-800/60';
            icon.className = `date-icon w-full rounded-2xl flex flex-col items-center justify-center border outline-none shadow-sm backdrop-blur-md ${isActive ? 'active text-white' : borderStyle}`;
            icon.innerHTML = `
                ${multiBadge}
                <span class="text-[9px] uppercase font-extrabold ${isActive ? 'text-sky-100' : 'text-sky-400'} tracking-wider z-10">${weekday}</span>
                <span class="text-[9px] uppercase font-bold ${isActive ? 'text-white' : 'opacity-60'} tracking-widest z-10">${month}</span>
                <span class="text-xl font-black leading-none ${isActive ? 'text-white' : ''} mt-0.5 z-10">${day}</span>`;

            icon.addEventListener('click', () => { 
                selectedProjectId = project.id; 
                renderTimeline(); 
                updateContentArea(); 
                document.getElementById('project-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            timeline.appendChild(icon);
        });
        lucide.createIcons();
    }

    async function updateContentArea() {
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (!project) return;

        document.getElementById('project-title-label').textContent = project.title;
        const contrLabel = document.getElementById('project-contractor-label');
        if(project.contractor) { contrLabel.classList.remove('hidden'); contrLabel.textContent = `Контрагент: ${project.contractor}`; } else { contrLabel.classList.add('hidden'); }

        const locContainer = document.getElementById('project-location-container');
        if (project.address || project.metro) {
            locContainer.classList.remove('hidden');
            let locHtml = `<div class="bg-black/30 border border-white/5 rounded-2xl p-4 mb-2 shadow-inner">`;
            if (project.address) {
                locHtml += `<div class="flex items-start gap-2 mb-2"><i data-lucide="map-pin" class="w-4 h-4 text-sky-400 shrink-0 mt-0.5"></i><a href="https://yandex.ru/maps/?text=${encodeURIComponent(project.address)}" target="_blank" class="text-[13px] text-sky-100 font-medium hover:text-sky-300 underline underline-offset-4 decoration-sky-500/30">${project.address}</a></div>`;
            }
            if (project.metro) {
                locHtml += `<div class="flex items-start gap-2 mb-1"><div class="w-4 h-4 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center shrink-0 mt-0.5 border border-red-500/30"><span class="text-[10px] font-bold">M</span></div><span class="text-[13px] text-gray-200 font-medium">${project.metro}</span></div>`;
            }
            if (project.address) {
                locHtml += `<iframe src="https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(project.address)}&z=15" width="100%" height="180" frameborder="0" allowfullscreen="true" class="rounded-xl border border-white/10 opacity-90 shadow-lg mt-1 pointer-events-auto"></iframe>`;
            }
            locHtml += `</div>`;
            locContainer.innerHTML = locHtml;
            lucide.createIcons({root: locContainer});
        } else { locContainer.classList.add('hidden'); }
        
        const datesContainer = document.getElementById('project-dates-container');
        datesContainer.innerHTML = '';
        
        project.dates.forEach(async (d, index) => {
            const dateObj = new Date(d.date);
            const formattedDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
            let timeHtml = (d.start || d.end) ? `<div class="flex items-center gap-1.5 text-sky-200 text-[11px] font-bold bg-sky-950/60 px-2.5 py-1 rounded-xl border border-sky-500/50 w-fit drop-shadow"><i data-lucide="clock" class="w-3.5 h-3.5 text-sky-400"></i> ${d.start || '09:00'} - ${d.end || '23:00'}</div>` : '';

            const row = document.createElement('div');
            row.className = "animated-info-card glow-sky-warm p-4 rounded-3xl shadow-2xl flex flex-col gap-3 backdrop-blur-md relative";
            row.innerHTML = `
                <canvas id="sky-canvas-${project.id}-${index}" class="sky-canvas"></canvas>
                <div class="card-content flex justify-between items-start z-10">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2 text-sky-300 text-xs font-extrabold uppercase tracking-wide drop-shadow">
                            <i data-lucide="calendar" class="w-4 h-4 text-sky-400"></i> ${formattedDate}
                        </div>
                        ${timeHtml}
                    </div>
                    <div id="weather-det-${project.id}-${index}" class="card-content flex items-center gap-3 z-10">
                        <div class="text-right text-[10px] text-gray-200 font-medium drop-shadow"><div class="opacity-80">Загрузка...</div></div>
                    </div>
                </div>
                <div class="card-content flex flex-col items-center justify-center pt-2 border-t border-white/10 z-10">
                    <div class="flex items-center justify-between w-full max-w-xs">
                        <div class="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold drop-shadow">
                            <i data-lucide="sunrise" class="w-4 h-4 text-amber-400"></i> <span id="sunrise-${project.id}-${index}">06:25</span>
                        </div>
                        <div class="w-28 md:w-36 h-2.5 metallic-arc relative overflow-hidden flex items-center justify-between px-1 mx-2">
                            <div class="absolute w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 via-orange-400 to-yellow-300 border border-white flex items-center justify-center pulsing-sun" style="left: 65%; top: -3px; transform: translateX(-50%);"></div>
                        </div>
                        <div class="flex items-center gap-1.5 text-orange-300 text-[11px] font-bold drop-shadow">
                            <i data-lucide="sunset" class="w-4 h-4 text-orange-400"></i> <span id="sunset-${project.id}-${index}">18:27</span>
                        </div>
                    </div>
                </div>`;
            datesContainer.appendChild(row);
            lucide.createIcons({root: row});

            const canvas = document.getElementById(`sky-canvas-${project.id}-${index}`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                canvas.width = row.offsetWidth || 350;
                canvas.height = row.offsetHeight || 140;

                let weatherType = 'clear';
                let isNight = false;

                try {
                    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=55.7522&longitude=37.6156&daily=weathercode,temperature_2m_max,sunrise,sunset&timezone=Europe%2FMoscow&start_date=${d.date}&end_date=${d.date}`);
                    const data = await res.json();
                    
                    if (data.daily && data.daily.weathercode && data.daily.weathercode.length > 0) {
                        const code = data.daily.weathercode[0];
                        const temp = Math.round(data.daily.temperature_2m_max[0]);
                        const sunrise = data.daily.sunrise[0].split('T')[1].substring(0, 5);
                        const sunset = data.daily.sunset[0].split('T')[1].substring(0, 5);
                        
                        document.getElementById(`sunrise-${project.id}-${index}`).textContent = sunrise;
                        document.getElementById(`sunset-${project.id}-${index}`).textContent = sunset;

                        if (code >= 51 && code <= 67 || code >= 80) { weatherType = 'rain'; }
                        else if (code >= 71 && code <= 77) { weatherType = 'snow'; }
                        else if (code >= 1 && code <= 3) { weatherType = 'clouds'; }

                        const checkHour = d.start ? parseInt(d.start.split(':')[0]) : new Date().getHours();
                        if (checkHour < 6 || checkHour >= 21) { isNight = true; }

                        let icon = '☀️';
                        if (isNight) icon = '🌙';
                        else if (weatherType === 'clouds') icon = '⛅';
                        else if (weatherType === 'rain') icon = '🌧️';
                        else if (weatherType === 'snow') icon = '❄️';

                        const detBox = document.getElementById(`weather-det-${project.id}-${index}`);
                        if(detBox) {
                            detBox.innerHTML = `
                                <div class="text-xl bg-black/50 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-sky-500/30 text-center shadow-inner flex items-center gap-2">
                                    <span class="weather-float">${icon}</span>
                                    <span class="text-xs font-black text-white">${temp > 0 ? '+' : ''}°${temp}</span>
                                </div>`;
                        }
                    } else {
                        throw new Error('Пустые данные погоды');
                    }
                } catch(err) {
                    const detBox = document.getElementById(`weather-det-${project.id}-${index}`);
                    if(detBox) {
                        detBox.innerHTML = `
                            <div class="text-right text-[10px] text-gray-400 font-medium drop-shadow">
                                <div>Нет прогноза</div>
                            </div>`;
                    }
                }

                const stars = [];
                if (isNight) {
                    for (let s = 0; s < 35; s++) {
                        stars.push({ x: Math.random() * canvas.width, y: Math.random() * (canvas.height * 0.7), r: Math.random() * 1.5 + 0.5, alpha: Math.random() });
                    }
                }

                class Cloud {
                    constructor() { this.reset(true); }
                    reset(init = false) {
                        this.x = init ? Math.random() * canvas.width : -150;
                        this.y = Math.random() * (canvas.height * 0.5);
                        this.speed = Math.random() * 0.08 + 0.03;
                        this.scale = Math.random() * 0.5 + 0.4;
                        this.opacity = isNight ? 0.15 : 0.35;
                        this.puffs = [{dx:0,dy:0,r:35*this.scale}, {dx:25,dy:-8,r:40*this.scale}, {dx:55,dy:4,r:35*this.scale}];
                    }
                    update() { this.x += this.speed; if (this.x - 100 > canvas.width) this.reset(false); }
                    draw() {
                        ctx.save();
                        ctx.fillStyle = isNight ? `rgba(200,220,255,${this.opacity})` : `rgba(255,255,255,${this.opacity})`;
                        ctx.shadowBlur = 8;
                        this.puffs.forEach(p => {
                            ctx.beginPath(); ctx.arc(this.x + p.dx, this.y + p.dy, p.r, 0, Math.PI * 2); ctx.fill();
                        });
                        ctx.restore();
                    }
                }

                const clouds = [];
                if (weatherType === 'clouds' || weatherType === 'rain' || weatherType === 'snow') {
                    for (let c = 0; c < 3; c++) clouds.push(new Cloud());
                }

                const particles = [];
                if (weatherType === 'rain' || weatherType === 'snow') {
                    for (let p = 0; p < 45; p++) {
                        particles.push({
                            x: Math.random() * canvas.width,
                            y: Math.random() * canvas.height,
                            length: weatherType === 'rain' ? Math.random() * 12 + 8 : Math.random() * 3 + 2,
                            speed: weatherType === 'rain' ? Math.random() * 4 + 5 : Math.random() * 1 + 1,
                            radius: weatherType === 'snow' ? Math.random() * 2 + 1 : 1
                        });
                    }
                }

                function animateSky() {
                    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
                    if (isNight) {
                        grad.addColorStop(0, '#020617'); grad.addColorStop(1, '#0f172a');
                    } else {
                        grad.addColorStop(0, '#0284c7'); grad.addColorStop(0.5, '#38bdf8'); grad.addColorStop(1, '#bae6fd');
                    }
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    if (isNight) {
                        stars.forEach(st => {
                            st.alpha += (Math.random() * 0.04 - 0.02);
                            if (st.alpha < 0.1) st.alpha = 0.1; if (st.alpha > 1) st.alpha = 1;
                            ctx.fillStyle = `rgba(255, 255, 255, ${st.alpha})`;
                            ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
                        });
                    }

                    clouds.forEach(cl => { cl.update(); cl.draw(); });

                    particles.forEach(pt => {
                        ctx.beginPath();
                        if (weatherType === 'rain') {
                            ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
                            ctx.lineWidth = 1.2;
                            ctx.moveTo(pt.x, pt.y);
                            ctx.lineTo(pt.x - 1, pt.y + pt.length);
                            ctx.stroke();
                        } else if (weatherType === 'snow') {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                            ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        pt.y += pt.speed;
                        if (weatherType === 'snow') pt.x += Math.sin(pt.y * 0.05) * 0.5;
                        if (pt.y > canvas.height) { pt.y = -10; pt.x = Math.random() * canvas.width; }
                    });

                    requestAnimationFrame(animateSky);
                }
                animateSky();
            }
        });

        const teamContainer = document.getElementById('project-team-container');
        const teamListHtml = document.getElementById('project-team-list');
        if (project.team && project.team.length > 0) {
            teamContainer.classList.remove('hidden');
            teamListHtml.innerHTML = '';
            let teamTotal = 0;
            project.team.forEach(member => {
                teamTotal += member.fee;
                teamListHtml.innerHTML += `<div class="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0"><span class="text-xs text-gray-300 flex items-center gap-2 font-medium truncate pr-2"><i data-lucide="user" class="w-3.5 h-3.5 text-sky-400"></i> ${member.name}</span><span class="text-xs font-bold text-white shrink-0">${member.fee.toLocaleString('ru-RU')} ₽</span></div>`;
            });
            document.getElementById('project-team-total').textContent = `${teamTotal.toLocaleString('ru-RU')} ₽`;
            lucide.createIcons({root: teamContainer});
        } else { teamContainer.classList.add('hidden'); }

        const financeBlock = document.getElementById('finance-block');
        const projectCostLabel = document.getElementById('project-cost-label');
        const projectMethodLabel = document.getElementById('project-method-label');
        const markPaidBtn = document.getElementById('mark-paid-btn');
        const paidStatus = document.getElementById('paid-status');
        const shareTelegramBtn = document.getElementById('share-telegram-btn');

        if (project.cost > 0) {
            financeBlock.classList.remove('hidden');
            projectCostLabel.textContent = `${project.cost.toLocaleString('ru-RU')} ₽`;
            projectMethodLabel.textContent = project.method;
            if (project.isPaid) {
                markPaidBtn.classList.add('hidden'); paidStatus.classList.remove('hidden'); shareTelegramBtn.classList.remove('hidden');
                projectCostLabel.className = 'text-2xl font-bold text-green-400';
            } else {
                markPaidBtn.classList.remove('hidden'); paidStatus.classList.add('hidden'); shareTelegramBtn.classList.add('hidden');
                projectCostLabel.className = 'text-2xl font-bold text-white';
            }
        } else { financeBlock.classList.add('hidden'); }
    }

    function renderCheckinSection(project) {
        const container = document.getElementById('checkin-list');
        const counter = document.getElementById('attendance-counter');
        const searchInput = document.getElementById('checkin-search');
        if (!container) return;

        if (!project.checkinList) {
            project.checkinList = [
                { name: "Сергей Филин", role: "Народный артист РФ", arrivedTime: null, leftTime: null },
                { name: "Диана Гурцкая", role: "Народная артистка РФ", arrivedTime: null, leftTime: null },
                { name: "Миа Бойка (Елизавета Бойко)", role: "Солистка", arrivedTime: null, leftTime: null },
                { name: "Алексей Чумаков", role: "Солист", arrivedTime: null, leftTime: null }
            ];
        }

        const filterText = searchInput ? searchInput.value.toLowerCase() : '';
        container.innerHTML = '';
        let onSiteCount = 0;

        project.checkinList.forEach((person, index) => {
            if (person.arrivedTime && !person.leftTime) onSiteCount++;
            if (filterText && !person.name.toLowerCase().includes(filterText) && !person.role.toLowerCase().includes(filterText)) return;

            const item = document.createElement('div');
            item.className = "bg-black/30 p-3 rounded-2xl border border-white/5 flex flex-col gap-2";
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="text-xs font-bold text-white">${person.name}</div>
                        <div class="text-[10px] text-gray-400">${person.role}</div>
                    </div>
                    <div class="flex flex-col items-end text-[10px]">
                        <span class="text-green-400 font-bold">Вход: ${person.arrivedTime || '—'}</span>
                        <span class="text-red-400 font-bold">Выход: ${person.leftTime || '—'}</span>
                    </div>
                </div>
                <div class="flex gap-2 mt-1">
                    <button type="button" class="arrived-btn flex-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 text-[11px] font-bold py-2 px-2 rounded-xl glow-green transition-colors flex justify-center items-center gap-1 active:scale-95" data-index="${index}">
                        <i data-lucide="log-in" class="w-3.5 h-3.5"></i> На площадке
                    </button>
                    <button type="button" class="left-btn flex-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 text-[11px] font-bold py-2 px-2 rounded-xl glow-red transition-colors flex justify-center items-center gap-1 active:scale-95" data-index="${index}">
                        <i data-lucide="log-out" class="w-3.5 h-3.5"></i> Уехал
                    </button>
                </div>`;
            container.appendChild(item);
        });

        if(counter) counter.textContent = `${onSiteCount} / ${project.checkinList.length} на площадке`;
        lucide.createIcons({root: container});

        container.querySelectorAll('.arrived-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.getAttribute('data-index');
                project.checkinList[idx].arrivedTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                syncData(project, null); renderCheckinSection(project);
            });
        });

        container.querySelectorAll('.left-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.getAttribute('data-index');
                project.checkinList[idx].leftTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                syncData(project, null); renderCheckinSection(project);
            });
        });
    }

    const checkinSearch = document.getElementById('checkin-search');
    if (checkinSearch) {
        checkinSearch.addEventListener('input', () => {
            const project = activeProjects.find(p => p.id === selectedProjectId);
            if (project) renderCheckinSection(project);
        });
    }

    function renderTransportSection(project) {
        const container = document.getElementById('transport-list');
        if (!container) return;
        if (!project.transportList) {
            project.transportList = [
                { model: "Автомобиль", number: "—", driver: "Семенов Иван", phone: "+79263451616" },
                { model: "Автомобиль", number: "—", driver: "Юра", phone: "+79166298513" }
            ];
        }
        container.innerHTML = '';
        if (project.transportList.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-500 text-xs py-2">Транспорт не добавлен</div>`;
            return;
        }
        project.transportList.forEach((car, index) => {
            const item = document.createElement('div');
            item.className = "bg-black/30 p-3 rounded-2xl border border-white/5 flex flex-col gap-2";
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="text-xs font-bold text-white flex items-center gap-1.5"><i data-lucide="car" class="w-3.5 h-3.5 text-purple-400"></i> ${car.model}</div>
                        <div class="text-xs font-mono text-yellow-400 font-bold mt-0.5">${car.number}</div>
                    </div>
                    <button type="button" class="delete-car text-red-400/80 hover:text-red-400 p-1" data-index="${index}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                <div class="flex justify-between items-center bg-gray-950/50 p-2 rounded-xl border border-white/5 mt-1">
                    <div>
                        <div class="text-[11px] text-gray-300 font-medium">${car.driver || 'Водитель не указан'}</div>
                        <div class="text-[10px] text-gray-500">${car.phone || 'Нет телефона'}</div>
                    </div>
                    ${car.phone ? `<a href="tel:${car.phone}" class="bg-green-600/20 text-green-400 hover:bg-green-600/30 p-2 rounded-xl glow-green flex items-center gap-1 text-xs font-bold"><i data-lucide="phone" class="w-3.5 h-3.5"></i> Звонок</a>` : ''}
                </div>`;
            container.appendChild(item);
        });
        lucide.createIcons({root: container});
        container.querySelectorAll('.delete-car').forEach(btn => {
            btn.addEventListener('click', (e) => {
                project.transportList.splice(e.currentTarget.getAttribute('data-index'), 1);
                syncData(project, null); renderTransportSection(project);
            });
        });
    }

    const transportModal = document.getElementById('transport-modal');
    document.getElementById('add-transport-btn').addEventListener('click', () => {
        document.getElementById('tr-model').value = '';
        document.getElementById('tr-number').value = '';
        document.getElementById('tr-driver').value = '';
        document.getElementById('tr-phone').value = '';
        transportModal.classList.remove('hidden'); transportModal.classList.add('flex');
    });

    document.getElementById('cancel-transport').addEventListener('click', () => { transportModal.classList.remove('flex'); transportModal.classList.add('hidden'); });

    document.getElementById('save-transport').addEventListener('click', () => {
        const model = document.getElementById('tr-model').value.trim();
        const number = document.getElementById('tr-number').value.trim();
        const driver = document.getElementById('tr-driver').value.trim();
        const phone = document.getElementById('tr-phone').value.trim();
        if (!model && !number) { alert('Укажите марку или номер машины!'); return; }
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (project) {
            if (!project.transportList) project.transportList = [];
            project.transportList.push({ model: model || 'Автомобиль', number: number || 'Без номера', driver, phone });
            syncData(project, null); renderTransportSection(project);
        }
        transportModal.classList.remove('flex'); transportModal.classList.add('hidden');
    });

    document.getElementById('mark-paid-btn').addEventListener('click', () => {
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (project) { project.isPaid = true; syncData(project, null); updateContentArea(); renderTimeline(); }
    });

    document.getElementById('paid-status').addEventListener('click', () => {
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (project) { project.isPaid = false; syncData(project, null); updateContentArea(); renderTimeline(); }
    });

    document.getElementById('share-telegram-btn').addEventListener('click', () => {
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (!project) return;
        let text = `✅ ОПЛАТА ПОЛУЧЕНА (ЧЕК)\n\n📁 Проект: ${project.title}\n`;
        if (project.contractor) text += `🏢 Контрагент: ${project.contractor}\n`;
        text += `💰 Сумма: ${project.cost.toLocaleString('ru-RU')} ₽\n💳 Способ: ${project.method}\n`;
        window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`, '_blank');
    });

    document.getElementById('delete-project-btn').addEventListener('click', () => {
        if (confirm('Точно удалить этот проект?')) {
            const idToDelete = selectedProjectId;
            activeProjects = activeProjects.filter(p => p.id !== idToDelete);
            selectedProjectId = activeProjects.length > 0 ? activeProjects[0].id : null;
            syncData(null, idToDelete); renderTimeline();
            if(selectedProjectId) updateContentArea();
        }
    });

    document.getElementById('edit-project-btn').addEventListener('click', () => {
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (project) {
            titleInput.value = project.title; contractorInput.value = project.contractor || '';
            addressInput.value = project.address || ''; metroInput.value = project.metro || '';
            costInput.value = project.cost; methodInput.value = project.method || 'Наличные';
            dynamicDatesList.innerHTML = '';
            project.dates.forEach(d => addDateRow(d.date, d.start || '09:00', d.end || '23:00'));
            renderTeamSelection(project.team);
            openModal(true);
        }
    });

    document.getElementById('share-project-btn').addEventListener('click', async () => {
        const project = activeProjects.find(p => p.id === selectedProjectId);
        if (!project) return;
        let text = `📁 Проект: ${project.title}\n`;
        if (project.contractor) text += `🏢 Контрагент: ${project.contractor}\n`;
        if (project.address) text += `📍 Площадка: ${project.address}\n`;
        if (project.metro) text += `🚇 Метро: ${project.metro}\n\nГрафик работы:\n`;
        project.dates.forEach(d => {
            const formatted = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(d.date));
            text += `📅 ${formatted} ⏰ ${d.start || '09:00'} - ${d.end || '23:00'}\n`;
        });
        if (project.team && project.team.length > 0) {
            text += `\n👥 Команда:\n`; let teamSum = 0;
            project.team.forEach(m => { text += `• ${m.name} — ${m.fee.toLocaleString('ru-RU')} ₽\n`; teamSum += m.fee; });
            text += `ФОТ Итого: ${teamSum.toLocaleString('ru-RU')} ₽\n`;
        }
        text += `\n💰 Смета: ${project.cost.toLocaleString('ru-RU')} ₽\n💵 Оплата: ${project.isPaid ? '✅ Оплачено' : '⏳ Ожидается'} (${project.method})`;
        if (navigator.share) { try { await navigator.share({ title: 'Отчет по проекту', text: text }); } catch (err) {} }
        else { navigator.clipboard.writeText(text); alert('Отчет скопирован в буфер обмена!'); }
    });

    const uploadInput = document.getElementById('excel-upload');
    const dataContainer = document.getElementById('excel-data-container');
    const emptyState = document.getElementById('excel-empty-state');

    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            renderExcelData(json);
        };
        reader.readAsArrayBuffer(file); e.target.value = '';
    });

    function renderExcelData(data) {
        dataContainer.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';
        const headers = data[0];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            let cardHtml = `<div class="bg-black/30 p-3 rounded-2xl border border-white/5 shadow-sm mb-2">`;
            row.forEach((cell, index) => {
                const headerName = headers[index] || `Колонка ${index + 1}`;
                if (cell !== undefined && cell !== null && cell !== '') {
                    cardHtml += `<div class="mb-1 last:mb-0 flex justify-between gap-4 border-b border-white/5 pb-1 last:border-0 last:pb-0"><span class="text-[11px] text-gray-500 font-bold uppercase tracking-wider">${headerName}</span><span class="text-xs text-gray-200 text-right font-medium">${cell}</span></div>`;
                }
            });
            cardHtml += `</div>`;
            dataContainer.innerHTML += cardHtml;
        }
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => {}));
}
