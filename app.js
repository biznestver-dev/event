document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const timeline = document.getElementById('dates-timeline');
    const timelineEmpty = document.getElementById('timeline-empty');
    const modal = document.getElementById('date-modal');
    const modalContent = document.getElementById('date-modal-content');
    
    // Поля формы
    const dateInput = document.getElementById('new-date-input');
    const titleInput = document.getElementById('new-project-title');
    const costInput = document.getElementById('new-project-cost');
    const methodInput = document.getElementById('new-project-method');
    
    // Блоки контента
    const contentArea = document.getElementById('date-content');
    const currentDateLabel = document.getElementById('current-date-label');
    const projectTitleLabel = document.getElementById('project-title-label');
    
    // Финансовый блок
    const financeBlock = document.getElementById('finance-block');
    const projectCostLabel = document.getElementById('project-cost-label');
    const projectMethodLabel = document.getElementById('project-method-label');
    const markPaidBtn = document.getElementById('mark-paid-btn');
    const paidStatus = document.getElementById('paid-status');

    let activeDates = [];
    let selectedDateId = null;

    // --- Модальное окно ---
    const openModal = () => {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('modal-active'), 10);
    };

    const closeModal = () => {
        modal.classList.remove('modal-active');
        setTimeout(() => modal.classList.add('hidden'), 300);
        // Сброс полей
        dateInput.value = '';
        titleInput.value = '';
        costInput.value = '';
        methodInput.value = '';
    };

    document.getElementById('add-date-btn').addEventListener('click', openModal);
    document.getElementById('cancel-date').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (!modalContent.contains(e.target)) closeModal();
    });

    // --- Сохранение проекта ---
    document.getElementById('save-date').addEventListener('click', () => {
        if (!dateInput.value) return;

        const dateObj = new Date(dateInput.value);
        const newProject = {
            id: dateInput.value,
            raw: dateObj,
            day: dateObj.getDate(),
            month: new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(dateObj).replace('.', ''),
            full: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj),
            title: titleInput.value || 'Без названия',
            cost: costInput.value ? Number(costInput.value) : null,
            method: methodInput.value || 'Не указано',
            isPaid: false // По умолчанию не оплачено
        };

        const existingIndex = activeDates.findIndex(d => d.id === newProject.id);
        if (existingIndex > -1) {
            // Обновляем, сохраняя статус оплаты, если он был
            newProject.isPaid = activeDates[existingIndex].isPaid;
            activeDates[existingIndex] = newProject;
        } else {
            activeDates.push(newProject);
            activeDates.sort((a, b) => a.raw - b.raw);
        }
        
        selectedDateId = newProject.id;
        renderTimeline();
        updateContentArea();
        closeModal();
    });

    // --- Отрисовка ленты дат ---
    function renderTimeline() {
        timeline.innerHTML = '';
        if (activeDates.length > 0) {
            if(timelineEmpty) timelineEmpty.style.display = 'none';
            contentArea.classList.remove('hidden');
        }

        activeDates.forEach(date => {
            const isActive = date.id === selectedDateId;
            const icon = document.createElement('button');
            
            let baseClasses = 'date-icon snap-center shrink-0 w-16 h-16 rounded-2xl flex flex-col items-center justify-center border outline-none ';
            
            // Если дата оплачена, можно добавить зеленую обводку (по желанию)
            const borderStyle = date.isPaid && !isActive ? 'border-green-500/50' : 'border-white/10';

            if (isActive) {
                icon.className = baseClasses + 'bg-gradient-to-b from-blue-500 to-blue-600 border-blue-400 text-white';
            } else {
                icon.className = baseClasses + `bg-gray-800/80 backdrop-blur-md ${borderStyle} text-gray-400`;
            }
            
            icon.innerHTML = `
                <span class="text-[10px] uppercase font-semibold ${isActive ? 'text-blue-100' : 'opacity-50'} mb-0.5 tracking-wider">${date.month}</span>
                <span class="text-2xl font-bold leading-none ${isActive ? 'text-white' : 'text-gray-200'}">${date.day}</span>
            `;

            icon.addEventListener('click', () => {
                selectedDateId = date.id;
                renderTimeline(); 
                updateContentArea();
            });

            timeline.appendChild(icon);
        });
        lucide.createIcons();
    }

    // --- Обновление данных выбранного проекта ---
    function updateContentArea() {
        const date = activeDates.find(d => d.id === selectedDateId);
        if (!date) return;

        currentDateLabel.textContent = date.full;
        projectTitleLabel.textContent = date.title;

        // Финансы
        if (date.cost) {
            financeBlock.classList.remove('hidden');
            projectCostLabel.textContent = `${date.cost.toLocaleString('ru-RU')} ₽`;
            projectMethodLabel.textContent = date.method;
            
            if (date.isPaid) {
                // Если оплачено: скрываем кнопку, показываем зеленую плашку
                markPaidBtn.classList.add('hidden');
                paidStatus.classList.remove('hidden');
                projectCostLabel.classList.remove('text-white');
                projectCostLabel.classList.add('text-green-400');
            } else {
                // Если не оплачено
                markPaidBtn.classList.remove('hidden');
                paidStatus.classList.add('hidden');
                projectCostLabel.classList.add('text-white');
                projectCostLabel.classList.remove('text-green-400');
            }
        } else {
            financeBlock.classList.add('hidden');
        }
    }

    // --- Кнопка "Оплатили" ---
    markPaidBtn.addEventListener('click', () => {
        const date = activeDates.find(d => d.id === selectedDateId);
        if (date) {
            date.isPaid = true;
            updateContentArea();
            renderTimeline(); // Перерисовываем ленту, чтобы обновить обводку (если нужно)
        }
    });

    // --- Парсинг Excel ---
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
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    });

    function renderExcelData(data) {
        dataContainer.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';

        const headers = data[0];
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            let cardHtml = `<div class="bg-gray-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-sm">`;
            row.forEach((cell, index) => {
                const headerName = headers[index] || `Колонка ${index + 1}`;
                if (cell !== undefined && cell !== null && cell !== '') {
                    cardHtml += `
                        <div class="mb-2 last:mb-0 flex justify-between gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <span class="text-xs text-gray-500 font-medium">${headerName}</span>
                            <span class="text-sm text-gray-200 text-right">${cell}</span>
                        </div>
                    `;
                }
            });
            cardHtml += `</div>`;
            dataContainer.innerHTML += cardHtml;
        }
    }
});
