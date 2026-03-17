// ---- App State ----
let supabaseClient = null;
let currentUser = null;
let allFichas = [];
let currentFichaId = null;
let fichaMap = null;
let fichaMarker = null;
let detailMap = null;
let detailMarker = null;
let currentStep = 1;
const totalSteps = 4; // 4 pasos: Info, Mapa, Infraestructura, PDF
let selectedCommentType = null;

// Coordenadas originales de la ficha que se está editando
let originalLat = null;
let originalLng = null;

// Modo de edición actual ('admin' o 'revisor')
let editMode = 'admin';

// ---- Comment Retention Policy ----
// Retención de comentarios: solo últimos 2 días (hoy y ayer) en el botón de mensajes
// Los comentarios se mantienen en la base de datos y en las fichas
const RETENTION_DAYS = 2;

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Supabase
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Initialize Lottie Animation
        initLottieAnimation();

        // Check Session
        checkSession();

        // Initialize Event Listeners
        initEventListeners();

        // Initialize Realtime (WebSockets)
        initRealtime();

    } catch (err) {
        console.error('Initialization error:', err);
        showToast('Error al inicializar la aplicación', 'error');
    }
});

function db() {
    return supabaseClient;
}

function navigateToDashboard() {
    if (!currentUser) return;

    // Hide Login View
    const loginView = document.getElementById('login-view');
    if (loginView) loginView.classList.remove('active');

    // Show appropriate Dashboard
    const role = currentUser ? currentUser.role : null;

    // Show/Hide messages button based on role
    const btnMessagesAdmin = document.getElementById('btn-messages-admin');
    const btnMessagesVisor = document.getElementById('btn-messages-visor');
    
    if (btnMessagesAdmin) {
        btnMessagesAdmin.style.display = role === 'admin' ? 'block' : 'none';
    }
    if (btnMessagesVisor) {
        btnMessagesVisor.style.display = role === 'visor' ? 'block' : 'none';
    }

    if (role === 'admin') {
        const adminName = document.getElementById('admin-user-name');
        if (adminName) adminName.textContent = currentUser.username;
        const brandAdmin = document.getElementById('brand-welcome-admin');
        if (brandAdmin) brandAdmin.textContent = 'Bienvenid@ ' + currentUser.username;
        showView('admin-view');
        loadFichas('admin-fichas-grid');
        // Load comments count for admin
        if (btnMessagesAdmin) {
            loadCommentsCount();
        }
    } else if (role === 'revisor') {
        const revisorName = document.getElementById('revisor-user-name');
        if (revisorName) revisorName.textContent = currentUser.username;
        const brandRevisor = document.getElementById('brand-welcome-revisor');
        if (brandRevisor) brandRevisor.textContent = 'Bienvenid@ ' + currentUser.username;
        showView('revisor-view');
        loadFichas('revisor-fichas-grid');
        // Load comments count for revisor
        const btnMessagesRevisor = document.getElementById('btn-messages-revisor');
        if (btnMessagesRevisor) {
            loadCommentsCountRevisor();
        }
    } else if (role === 'visor') {
        const visorName = document.getElementById('visor-user-name');
        if (visorName) visorName.textContent = currentUser.username;
        const brandVisor = document.getElementById('brand-welcome-visor');
        if (brandVisor) brandVisor.textContent = 'Bienvenid@ ' + currentUser.username;
        showView('visor-view');
        loadFichas('visor-fichas-grid');
        // Load comments count for visor
        if (btnMessagesVisor) {
            loadCommentsCountVisor();
        }
    }
}

// ---- Session & Auth ----
function checkSession() {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        // Show loading screen before navigating to dashboard
        showLoadingScreen(() => {
            navigateToDashboard();
        });
    }
}

// ---- Session & Auth (Continued) ----
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    errorEl.style.display = 'none';
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    console.log('Intentando login con:', username);

    try {
        const { data, error } = await db()
            .from('usuarios')
            .select('*')
            .eq('username', username)
            .eq('password_hash', password)
            .single();

        console.log('Resultado login:', { data, error });

        if (error) {
            console.error('Error de Supabase:', error);
            errorEl.textContent = 'Error de conexión: ' + error.message;
            errorEl.style.display = 'block';
            btn.innerHTML = 'Iniciar Sesión';
            btn.disabled = false;
            return;
        }

        if (!data) {
            errorEl.textContent = 'Usuario o contraseña incorrectos';
            errorEl.style.display = 'block';
            btn.innerHTML = 'Iniciar Sesión';
            btn.disabled = false;
            return;
        }

        currentUser = data;
        sessionStorage.setItem('currentUser', JSON.stringify(data));

        // Show loading screen instead of toast
        showLoadingScreen(() => {
            // First Login Tutorial Logic
            const firstLoginKey = `first_login_${data.id}`;
            if (!localStorage.getItem(firstLoginKey)) {
                localStorage.setItem(firstLoginKey, 'false');
                
                // Primero navegamos al dashboard para estar dentro de la interfaz
                navigateToDashboard();
                
                // Luego mostramos el tutorial (con un pequeño delay para asegurar que la vista está renderizada)
                setTimeout(() => {
                    if (data.role === 'admin') {
                        showTutorial();
                    } else if (data.role === 'revisor') {
                        showTutorialRevisor();
                    } else if (data.role === 'visor') {
                        showTutorialVisor();
                    }
                }, 100);
            } else {
                navigateToDashboard();
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        errorEl.textContent = 'Error de conexión. Verifica tu configuración.';
        errorEl.style.display = 'block';
    }

    btn.innerHTML = 'Iniciar Sesión';
    btn.disabled = false;
}

function navigateToDashboard() {
    if (!currentUser) return;

    // Hide Login View
    document.getElementById('login-view').classList.remove('active');

    // Show appropriate Dashboard
    const role = currentUser.role;

    // Show/Hide messages button based on role
    const btnMessagesAdmin = document.getElementById('btn-messages-admin');
    const btnMessagesVisor = document.getElementById('btn-messages-visor');
    
    if (btnMessagesAdmin) {
        btnMessagesAdmin.style.display = role === 'admin' ? 'block' : 'none';
    }
    if (btnMessagesVisor) {
        btnMessagesVisor.style.display = role === 'visor' ? 'block' : 'none';
    }

    if (role === 'admin') {
        document.getElementById('admin-user-name').textContent = currentUser.username;
        document.getElementById('brand-welcome-admin').textContent = 'Bienvenid@ ' + currentUser.username;
        showView('admin-view');
        loadFichas('admin-fichas-grid');
        // Load comments count for admin
        if (btnMessagesAdmin) {
            loadCommentsCount();
        }
    } else if (role === 'revisor') {
        document.getElementById('revisor-user-name').textContent = currentUser.username;
        document.getElementById('brand-welcome-revisor').textContent = 'Bienvenid@ ' + currentUser.username;
        showView('revisor-view');
        loadFichas('revisor-fichas-grid');
        // Load comments count for revisor
        const btnMessagesRevisor = document.getElementById('btn-messages-revisor');
        if (btnMessagesRevisor) {
            loadCommentsCountRevisor();
        }
    } else if (role === 'visor') {
        document.getElementById('visor-user-name').textContent = currentUser.username;
        document.getElementById('brand-welcome-visor').textContent = 'Bienvenid@ ' + currentUser.username;
        showView('visor-view');
        loadFichas('visor-fichas-grid');
        // Load comments count for visor
        if (btnMessagesVisor) {
            loadCommentsCountVisor();
        }
    }
}

function handleLogout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    window.location.reload();
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// ---- Event Listeners ----
function initEventListeners() {
    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Logout
    document.querySelectorAll('.btn-logout').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });

    // Admin Actions
    const actionCreateUser = document.getElementById('action-create-user');
    if (actionCreateUser) actionCreateUser.addEventListener('click', () => openModal('modal-create-user'));

    const actionManageUsers = document.getElementById('action-manage-users');
    if (actionManageUsers) actionManageUsers.addEventListener('click', openManageUsersModal);

    const actionCreateFicha = document.getElementById('action-create-ficha');
    if (actionCreateFicha) actionCreateFicha.addEventListener('click', openFichaModal);

    const actionDeleteFicha = document.getElementById('action-delete-ficha');
    if (actionDeleteFicha) actionDeleteFicha.addEventListener('click', openDeleteFichaModal);

    // Save User
    const btnSaveUser = document.getElementById('btn-save-user');
    if (btnSaveUser) btnSaveUser.addEventListener('click', handleCreateUser);

    // Ficha Modal Navigation
    const btnFichaPrev = document.getElementById('btn-ficha-prev');
    if (btnFichaPrev) btnFichaPrev.addEventListener('click', prevStep);

    const btnFichaNext = document.getElementById('btn-ficha-next');
    if (btnFichaNext) btnFichaNext.addEventListener('click', nextStep);

    const btnFichaSave = document.getElementById('btn-ficha-save');
    if (btnFichaSave) btnFichaSave.addEventListener('click', handleSaveFicha);

    // Infrastructure Inputs (Step 3) - Auto-calculate status
    const infraIds = ['ficha-topografia', 'ficha-mecanica-text', 'ficha-gas', 'ficha-agua', 'ficha-drenaje', 'ficha-expediente'];
    infraIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateStatusPreview);
    });

    // PDF Upload Preview
    const pdfInput = document.getElementById('ficha-pdf-input');
    if (pdfInput) {
        pdfInput.addEventListener('change', function (e) {
            const files = e.target.files;
            const previewList = document.getElementById('pdf-preview-list');
            if (!previewList) return;

            previewList.innerHTML = '';
            for (let file of files) {
                const item = document.createElement('div');
                item.className = 'pdf-item';
                item.innerHTML = `
                    <i class="fas fa-file-pdf"></i>
                    <span>${file.name}</span>
                    <span style="color: #666; font-size: 0.8em;">(${(file.size / 1024).toFixed(1)} KB)</span>
                `;
                previewList.appendChild(item);
            }
        });
    }

    // Report Buttons
    ['btn-report-general', 'btn-report-general-revisor', 'btn-report-general-visor'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', openReport);
    });

    const btnPrint = document.getElementById('btn-print-report');
    if (btnPrint) btnPrint.addEventListener('click', printReport);

    const btnExportPPT = document.getElementById('btn-export-powerpoint');
    if (btnExportPPT) btnExportPPT.addEventListener('click', exportToPowerPoint);

    // Export Buttons
    // PDF Export
    ['btn-export-pdf-admin', 'btn-export-pdf-revisor', 'btn-export-pdf-visor'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => exportToPDF(id));
    });

    // Excel Export
    ['btn-export-excel-admin', 'btn-export-excel-revisor', 'btn-export-excel-visor'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => exportToExcel(id));
    });

    // Messages button (for admin, visor and revisor)
    const btnMessagesAdmin = document.getElementById('btn-messages-admin');
    if (btnMessagesAdmin) {
        console.log('Botón de mensajes admin encontrado, agregando evento click');
        btnMessagesAdmin.addEventListener('click', function (e) {
            console.log('Click en botón de mensajes admin');
            e.stopPropagation();
            toggleMessagesDropdown();
        });
        // Load comments count on page load for admin
        loadCommentsCount();
    } else {
        console.log('Botón de mensajes admin NO encontrado');
    }

    const btnMessagesVisor = document.getElementById('btn-messages-visor');
    if (btnMessagesVisor) {
        console.log('Botón de mensajes visor encontrado, agregando evento click');
        btnMessagesVisor.addEventListener('click', function (e) {
            console.log('Click en botón de mensajes visor');
            e.stopPropagation();
            toggleMessagesDropdown();
        });
        // Load comments count on page load for visor
        // Se cargará en la función checkSession cuando se detecte el rol visor
    } else {
        console.log('Botón de mensajes visor NO encontrado');
    }

    const btnMessagesRevisor = document.getElementById('btn-messages-revisor');
    if (btnMessagesRevisor) {
        console.log('Botón de mensajes revisor encontrado, agregando evento click');
        btnMessagesRevisor.addEventListener('click', function (e) {
            console.log('Click en botón de mensajes revisor');
            e.stopPropagation();
            toggleMessagesDropdown();
        });
        // Load comments count on page load for revisor
        // Se cargará en la función checkSession cuando se detecte el rol revisor
    } else {
        console.log('Botón de mensajes revisor NO encontrado');
    }

    // Search functionality
    ['admin', 'revisor', 'visor'].forEach(profile => {
        const searchInput = document.getElementById(`search-${profile}`);
        if (searchInput) {
            searchInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') searchFichas(profile);
            });
        }
    });

    // Comments
    document.querySelectorAll('.comment-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.comment-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedCommentType = btn.dataset.type;
        });
    });

    const btnSubmitComment = document.getElementById('btn-submit-comment');
    if (btnSubmitComment) btnSubmitComment.addEventListener('click', handleSubmitComment);

    // Modal Close
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });
}

// ---- Modal Management ----
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        // Initialize map if opening ficha modal (ahora se hace en nextStep)
        if (id === 'modal-ficha') {
            // Se inicializará en nextStep cuando se llegue al paso 2
        }
        if (id === 'modal-ficha-detail') {
            setTimeout(() => {
                if (detailMap) detailMap.invalidateSize();
            }, 300);
        }
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');

    if (id === 'modal-ficha') {
        resetFichaModal();
    }
}

// ---- User Management ----
async function handleCreateUser() {
    const nombre = document.getElementById('new-user-nombre').value.trim();
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;

    if (!nombre || !username || !password || !role) {
        showToast('Completa todos los campos', 'error');
        return;
    }

    try {
        const { error } = await db()
            .from('usuarios')
            .insert([{ nombre, username, password_hash: password, role }]);

        if (error) {
            if (error.message.includes('duplicate') || error.message.includes('unique')) {
                showToast('El usuario ya existe', 'error');
            } else {
                showToast('Error: ' + error.message, 'error');
            }
            return;
        }

        showToast('Usuario creado exitosamente', 'success');
        document.getElementById('form-create-user').reset();
        closeModal('modal-create-user');
    } catch (err) {
        showToast('Error de conexión', 'error');
    }
}

// ---- User Management: List and Delete ----
async function openManageUsersModal() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '<div class="empty-users">Cargando usuarios...</div>';

    openModal('modal-manage-users');

    try {
        const { data: users, error } = await db()
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!users || users.length === 0) {
            usersList.innerHTML = '<div class="empty-users">No hay usuarios registrados</div>';
            return;
        }

        let html = '';
        users.forEach(user => {
            // No permitir eliminar el usuario actual ni el usuario admin por defecto
            const isCurrentUser = currentUser && user.id === currentUser.id;
            const isDefaultAdmin = user.username === 'admin';
            const canDelete = !isCurrentUser && !isDefaultAdmin;

            html += `
                <div class="user-item">
                    <div class="user-info">
                        <div style="display: flex; align-items: center;">
                            <span class="user-name">${user.nombre}</span>
                            <span class="user-role ${user.role}">${user.role.toUpperCase()}</span>
                        </div>
                        <span class="user-username">@${user.username}</span>
                    </div>
                    ${canDelete ?
                    `<button class="btn-delete-user" onclick="handleDeleteUser('${user.id}', '${user.nombre}')">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>` :
                    `<span style="color: #999; font-size: 0.85rem;">${isCurrentUser ? 'Tú' : 'Principal'}</span>`
                }
                </div>
            `;
        });

        usersList.innerHTML = html;
    } catch (err) {
        console.error('Error loading users:', err);
        usersList.innerHTML = '<div class="empty-users">Error al cargar usuarios</div>';
    }
}

// ---- Ficha Management: List and Delete ----
async function openDeleteFichaModal() {
    const fichasList = document.getElementById('delete-ficha-list');
    fichasList.innerHTML = '<div class="empty-fichas">Cargando fichas...</div>';

    openModal('modal-delete-ficha');

    try {
        const { data: fichas, error } = await db()
            .from('fichas')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!fichas || fichas.length === 0) {
            fichasList.innerHTML = '<div class="empty-fichas">No hay fichas registradas</div>';
            return;
        }

        let html = '';
        fichas.forEach(ficha => {
            html += `
                <div class="ficha-delete-item">
                    <div class="ficha-info">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="ficha-folio">${ficha.folio || 'Sin folio'}</span>
                            <span class="ficha-concepto">${ficha.concepto || 'Sin concepto'}</span>
                        </div>
                        <span class="ficha-sifais">SIFAIS: ${ficha.sifais || 'N/A'}</span>
                    </div>
                    <button class="btn-delete-ficha" onclick="handleDeleteFicha('${ficha.id}', '${ficha.folio || 'Sin folio'}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            `;
        });

        fichasList.innerHTML = html;
    } catch (err) {
        console.error('Error loading fichas:', err);
        fichasList.innerHTML = '<div class="empty-fichas">Error al cargar fichas</div>';
    }
}

async function handleDeleteFicha(fichaId, folio) {
    const message = `¿Estás seguro de que deseas eliminar la ficha "${folio}"?\n\nNOTA: Esta acción es permanente.`;

    const confirmed = await showDeleteNotification(message);

    if (!confirmed) {
        return;
    }

    try {
        // 1. Obtener los PDFs asociados a la ficha
        const { data: archivos, error: fetchError } = await db()
            .from('archivos_ficha')
            .select('nombre_optimizado')
            .eq('ficha_id', fichaId);

        if (fetchError) throw fetchError;

        // 2. Eliminar los archivos de Supabase Storage
        if (archivos && archivos.length > 0) {
            const fileNames = archivos.map(arch => arch.nombre_optimizado);
            const { error: storageError } = await supabaseClient.storage
                .from('archivos_ficha')
                .remove(fileNames);

            if (storageError) throw storageError;

            // 3. Eliminar los registros de la tabla archivos_ficha
            const { error: dbError } = await db()
                .from('archivos_ficha')
                .delete()
                .eq('ficha_id', fichaId);

            if (dbError) throw dbError;
        }

        // 4. Eliminar la ficha
        const { error } = await db()
            .from('fichas')
            .delete()
            .eq('id', fichaId);

        if (error) throw error;

        showToast('Ficha eliminada correctamente', 'success');

        // 5. Recargar la lista en el modal de eliminación (sin cerrarlo)
        const fichasList = document.getElementById('delete-ficha-list');
        if (fichasList) {
            fichasList.innerHTML = '<div class="empty-fichas">Actualizando lista...</div>';
            
            const { data: fichas, error } = await db()
                .from('fichas')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error; // Si falla la recarga, mostraremos error pero la ficha ya se eliminó

            if (!fichas || fichas.length === 0) {
                fichasList.innerHTML = '<div class="empty-fichas">No hay fichas registradas</div>';
            } else {
                fichasList.innerHTML = generateFichaDeleteHTML(fichas);
            }
        }

        // 6. Actualizar la lista principal de fichas en el panel de administración
        loadFichas('admin-fichas-grid');

    } catch (err) {
        console.error('Error deleting ficha:', err);
        showToast('Error al eliminar la ficha', 'error');
    }
}

async function handleDeleteUser(userId, userName) {
    const message = `¿Estás seguro de que deseas eliminar al usuario "${userName}"?\n\nNOTA: Esto también eliminará todos los comentarios hechos por este usuario.`;

    const confirmed = await showDeleteNotification(message);

    if (!confirmed) {
        return;
    }

    try {
        // Primero, eliminar los comentarios del usuario
        const { error: commentsError } = await db()
            .from('comentarios')
            .delete()
            .eq('usuario_id', userId);

        if (commentsError) throw commentsError;

        // Luego, eliminar al usuario
        const { error: userError } = await db()
            .from('usuarios')
            .delete()
            .eq('id', userId);

        if (userError) throw userError;

        showToast('Usuario y sus comentarios eliminados exitosamente', 'success');
        openManageUsersModal(); // Recargar la lista
    } catch (err) {
        console.error('Error deleting user:', err);
        showToast('Error al eliminar usuario', 'error');
    }
}

function generateFichaDeleteHTML(fichas) {
    let html = '';
    fichas.forEach(ficha => {
        html += `
            <div class="ficha-delete-item">
                <div class="ficha-info">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="ficha-folio">${ficha.folio || 'Sin folio'}</span>
                        <span class="ficha-concepto">${ficha.concepto || 'Sin concepto'}</span>
                    </div>
                    <span class="ficha-sifais">SIFAIS: ${ficha.sifais || 'N/A'}</span>
                </div>
                <button class="btn-delete-ficha" onclick="handleDeleteFicha('${ficha.id}', '${ficha.folio || 'Sin folio'}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
    });
    return html;
}

// ---- Custom Delete Notification ----
let deleteAnimation = null;

function showDeleteNotification(message) {
    return new Promise((resolve) => {
        // Usamos una variable local para resolver la promesa actual, evitando conflictos entre múltiples modales
        const currentResolve = resolve;

        const overlay = document.getElementById('delete-notification');
        const messageEl = document.getElementById('delete-notification-message');
        const container = document.getElementById('delete-animation-container');

        messageEl.textContent = message;

        // Inicializar animación Lottie si no existe
        if (!deleteAnimation) {
            deleteAnimation = lottie.loadAnimation({
                container: container,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                path: 'assets/Delete Animation.json'
            });

            // Configurar para que dure exactamente 50 frames
            deleteAnimation.addEventListener('DOMLoaded', () => {
                // Obtener FPS de la animación (por defecto 30)
                const fps = deleteAnimation.frameRate || 30;
                const totalFrames = 50;
                const duration = (totalFrames / fps) * 1000; // duración en ms

                // Guardar la duración para usarla después
                deleteAnimation.customDuration = duration;
            });
        } else {
            deleteAnimation.stop();
        }

        // Mostrar notificación
        overlay.classList.add('active');

        // Manejar botones
        const cancelBtn = document.getElementById('delete-cancel-btn');
        const confirmBtn = document.getElementById('delete-confirm-btn');

        // Limpiar event listeners previos
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));

        // Obtener nuevos elementos después de reemplazarlos
        const newCancelBtn = document.getElementById('delete-cancel-btn');
        const newConfirmBtn = document.getElementById('delete-confirm-btn');

        newCancelBtn.addEventListener('click', () => {
            overlay.classList.remove('active');
            currentResolve(false);
        });

        newConfirmBtn.addEventListener('click', () => {
            // Usar la duración calculada o un valor por defecto de 1.67 segundos (50 frames a 30fps)
            const duration = deleteAnimation.customDuration || 1667;

            // Iniciar animación desde el frame 0 hasta el frame 49 (50 frames)
            deleteAnimation.playSegments([0, 49], true);

            // Esperar la duración exacta de 50 frames
            setTimeout(() => {
                overlay.classList.remove('active');
                currentResolve(true);
            }, duration);
        });
    });
}

// ---- Ficha Management ----
function openFichaModal(editData = null, mode = 'admin') {
    console.log('openFichaModal called with editData:', editData);
    // Guardar el modo actual
    editMode = mode;

    // Determinar el paso inicial según el modo
    if (mode === 'revisor') {
        currentStep = 3; // Revisores solo ven el paso 3
    } else {
        currentStep = 1; // Administradores empiezan en el paso 1
    }

    currentFichaId = editData ? editData.id : null;
    updateStepUI();

    if (editData && editData.id) {
        document.getElementById('modal-ficha-title').innerHTML = '<i class="fas fa-edit"></i> Editar Ficha';
        // Guardar coordenadas originales
        originalLat = editData.lat || null;
        originalLng = editData.lng || null;
        populateFichaForm(editData);
        // Cargar PDFs existentes
        console.log('Cargando PDFs existentes para ficha ID:', editData.id);
        loadExistingPDFs(editData.id);
    } else {
        document.getElementById('modal-ficha-title').innerHTML = '<i class="fas fa-file-alt"></i> Nueva Ficha';
        // Limpiar coordenadas originales para nueva ficha
        originalLat = null;
        originalLng = null;
        resetFichaForm();
        // Ocultar sección de PDFs existentes
        const existingPdfsSection = document.getElementById('existing-pdfs-section');
        if (existingPdfsSection) existingPdfsSection.style.display = 'none';
    }

    // Ocultar/mostrar botones de navegación según el modo
    const btnPrev = document.getElementById('btn-ficha-prev');
    const btnNext = document.getElementById('btn-ficha-next');

    // El revisor puede navegar entre el paso 3 y 4
    if (mode === 'revisor') {
        if (btnPrev) btnPrev.style.display = 'block'; // Habilitar botón anterior para volver al paso 3 desde el 4
        if (btnNext) btnNext.style.display = 'block'; // Habilitar botón siguiente para avanzar al paso 4 desde el 3
    } else {
        if (btnPrev) btnPrev.style.display = 'block';
        if (btnNext) btnNext.style.display = 'block';
    }

    openModal('modal-ficha');
}

function resetFichaModal() {
    currentStep = 1;
    currentFichaId = null;
    originalLat = null;
    originalLng = null;
    updateStepUI();
    resetFichaForm();
    if (fichaMap) {
        fichaMap.remove();
        fichaMap = null;
        fichaMarker = null;
    }

    // Re-habilitar el botón de guardar
    const btnSave = document.getElementById('btn-ficha-save');
    if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}

function resetFichaForm() {
    const inputs = [
        'ficha-folio', 'ficha-sifais', 'ficha-tipo', 'ficha-tiempo-ejecucion',
        'ficha-concepto', 'ficha-m2', 'ficha-longitud', 'ficha-costo-parametrico',
        'ficha-origen-recursos', 'ficha-anio', 'ficha-calle', 'ficha-topografia', 'ficha-mecanica-text', 'ficha-gas',
        'ficha-agua', 'ficha-drenaje', 'ficha-alumbrado-text', 'ficha-via-ciclista-text',
        'ficha-zap', 'ficha-definicion', 'ficha-expediente'
    ];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Resetear valores numéricos a 0
    ['ficha-gas', 'ficha-agua', 'ficha-drenaje', 'ficha-expediente'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 0;
    });

    const coordDisplay = document.getElementById('coord-display');
    if (coordDisplay) coordDisplay.textContent = 'Coordenadas: Sin seleccionar';

    // Limpiar input de archivos PDF
    const pdfInput = document.getElementById('ficha-pdf-input');
    if (pdfInput) pdfInput.value = '';

    // Limpiar vista previa de PDFs
    const pdfPreview = document.getElementById('pdf-preview-list');
    if (pdfPreview) pdfPreview.innerHTML = '';

    // Ocultar sección de PDFs existentes
    const existingPdfsSection = document.getElementById('existing-pdfs-section');
    if (existingPdfsSection) existingPdfsSection.style.display = 'none';

    updateStatusPreview();
}

function populateFichaForm(data) {
    // Campos del paso 1
    const step1Fields = [
        'ficha-folio', 'ficha-sifais', 'ficha-tipo', 'ficha-tiempo-ejecucion',
        'ficha-concepto', 'ficha-m2', 'ficha-longitud', 'ficha-costo-parametrico',
        'ficha-origen-recursos', 'ficha-anio'
    ];
    
    // Campos del paso 2
    const step2Fields = ['ficha-calle'];
    
    // Campos del paso 3
    const step3Fields = [
        'ficha-topografia', 'ficha-mecanica-text', 'ficha-gas', 'ficha-agua',
        'ficha-drenaje', 'ficha-alumbrado-text', 'ficha-via-ciclista-text',
        'ficha-zap', 'ficha-definicion', 'ficha-expediente'
    ];

    // Función para establecer el estado de los campos
    const setFieldState = (fieldIds, disabled) => {
        fieldIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = disabled;
        });
    };

    // Si es modo revisor, deshabilitar campos del paso 1 y 2
    if (editMode === 'revisor') {
        setFieldState(step1Fields, true);
        setFieldState(step2Fields, true);
    } else {
        // Habilitar todos los campos para administradores
        setFieldState([...step1Fields, ...step2Fields], false);
    }
    
    // Los campos del paso 3 siempre están habilitados (el revisor puede editarlos)
    setFieldState(step3Fields, false);

    // Llenar los valores
    document.getElementById('ficha-folio').value = data.folio || '';
    document.getElementById('ficha-sifais').value = data.sifais || '';
    document.getElementById('ficha-tipo').value = data.tipo || '';
    document.getElementById('ficha-tiempo-ejecucion').value = data.tiempo_ejecucion || '';
    document.getElementById('ficha-concepto').value = data.concepto || '';
    document.getElementById('ficha-m2').value = data.m2 || '';
    document.getElementById('ficha-longitud').value = data.longitud || '';
    document.getElementById('ficha-costo-parametrico').value = data.costo_parametrico || '';
    document.getElementById('ficha-origen-recursos').value = data.origen_recursos || '';
    document.getElementById('ficha-anio').value = data.anio || '';
    document.getElementById('ficha-calle').value = data.calle || '';
    document.getElementById('ficha-topografia').value = data.topografia || '';
    document.getElementById('ficha-mecanica-text').value = data.mecanica || '';
    document.getElementById('ficha-gas').value = data.gas || 0;
    document.getElementById('ficha-agua').value = data.agua || 0;
    document.getElementById('ficha-drenaje').value = data.drenaje || 0;
    document.getElementById('ficha-alumbrado-text').value = data.alumbrado || '';
    document.getElementById('ficha-via-ciclista-text').value = data.via_ciclista || '';
    document.getElementById('ficha-zap').value = data.zap || '';
    document.getElementById('ficha-definicion').value = data.definicion || '';
    document.getElementById('ficha-expediente').value = data.expediente || 0;

    if (data.lat && data.lng) {
        document.getElementById('coord-display').textContent = `Coordenadas: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;
    }
    updateStatusPreview();
}

// ---- Multi-Step Logic ----
function nextStep() {
    // Revisores solo pueden navegar del paso 3 al 4
    if (editMode === 'revisor') {
        if (currentStep === 3) {
            currentStep++;
            updateStepUI();
        }
        return;
    }

    if (currentStep < totalSteps) {
        currentStep++;
        updateStepUI();
        if (currentStep === 2) {
            // Inicializar mapa solo si no existe
            if (!fichaMap) {
                setTimeout(() => initFichaMap(), 100);
            } else {
                setTimeout(() => { if (fichaMap) fichaMap.invalidateSize(); }, 100);
            }
        }
    }
}

function prevStep() {
    // Revisores solo pueden navegar del paso 4 al 3
    if (editMode === 'revisor') {
        if (currentStep === 4) {
            currentStep--;
            updateStepUI();
        }
        return;
    }

    if (currentStep > 1) {
        currentStep--;
        updateStepUI();
    }
}

function updateStepUI() {
    document.querySelectorAll('.step-dot').forEach(dot => {
        const s = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (s === currentStep) dot.classList.add('active');
        else if (s < currentStep) dot.classList.add('completed');
    });

    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
        if (parseInt(content.dataset.step) === currentStep) content.classList.add('active');
    });

    document.getElementById('btn-ficha-prev').style.display = currentStep > 1 ? 'inline-flex' : 'none';
    document.getElementById('btn-ficha-next').style.display = currentStep < totalSteps ? 'inline-flex' : 'none';
    document.getElementById('btn-ficha-save').style.display = currentStep === totalSteps ? 'inline-flex' : 'none';
}

function calculateInfrastructurePercent() {
    // Lógica: Cada punto vale 20%
    // 1. Topografía (texto): Si tiene contenido -> 20%
    // 2. Mecánica (texto): Si tiene contenido -> 20%
    // 3. Gas (número): Si > 49 -> 20%
    // 4. Agua (número): Si > 49 -> 20%
    // 5. Drenaje (número): Si > 49 -> 20%

    const topografiaVal = document.getElementById('ficha-topografia').value.trim();
    const mecanicaVal = document.getElementById('ficha-mecanica-text').value.trim();
    const gasVal = parseInt(document.getElementById('ficha-gas').value) || 0;
    const aguaVal = parseInt(document.getElementById('ficha-agua').value) || 0;
    const drenajeVal = parseInt(document.getElementById('ficha-drenaje').value) || 0;

    let autoPercent = 0;

    if (topografiaVal.toLowerCase() === 'si') autoPercent += 20;
    if (mecanicaVal.toLowerCase() === 'si') autoPercent += 20;
    if (gasVal > 49) autoPercent += 20;
    if (aguaVal > 49) autoPercent += 20;
    if (drenajeVal > 49) autoPercent += 20;

    return autoPercent;
}

function updateStatusPreview() {
    // El avance se calcula basado en la infraestructura instalada
    const percent = calculateInfrastructurePercent();

    const percentDisplay = document.getElementById('ficha-status-percent');
    const statusBar = document.getElementById('ficha-status-bar');
    const fill = statusBar ? statusBar.querySelector('.fill') : null;
    const expedienteInput = document.getElementById('ficha-expediente');

    if (percentDisplay) percentDisplay.textContent = percent + '%';
    if (statusBar) {
        let statusClass = 'status-low';
        if (percent >= 80) statusClass = 'status-high';
        else if (percent >= 40) statusClass = 'status-medium';
        statusBar.className = 'status-bar ' + statusClass;
    }
    if (fill) fill.style.width = percent + '%';
    
    // Actualizar el campo de expediente para reflejar el cálculo automático
    // Esto evita la inconsistencia donde el usuario escribe un valor que es ignorado
    if (expedienteInput) expedienteInput.value = percent;
}

// ---- Leaflet Map ----
function initFichaMap() {
    const mapContainer = document.getElementById('ficha-map');
    if (!mapContainer) {
        console.log('Map container not found');
        return;
    }

    if (fichaMap) {
        fichaMap.remove();
        fichaMap = null;
    }

    // Usar coordenadas originales si existen, de lo contrario usar coordenadas de Puebla
    const initialLat = originalLat || 19.058297893452245;
    const initialLng = originalLng || -98.22266849121463;
    fichaMap = L.map('ficha-map').setView([initialLat, initialLng], 15);

    // Si hay coordenadas originales, colocar el marcador
    if (originalLat && originalLng) {
        placeMarker(originalLat, originalLng);
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(fichaMap);

    // Geocoder 
    const geocoder = L.Control.Geocoder.nominatim();
    L.Control.geocoder({
        geocoder: geocoder,
        defaultMarkGeocode: false,
        placeholder: 'Buscar dirección...'
    }).on('markgeocode', function (e) {
        const center = e.geocode.center;
        placeMarker(center.lat, center.lng, e.geocode.name);
        fichaMap.setView(center, 16);
    }).addTo(fichaMap);

    // Click to place marker and reverse geocode
    fichaMap.on('click', function (e) {
        placeMarker(e.latlng.lat, e.latlng.lng);

        // Reverse geocoding to get street name
        geocoder.reverse(e.latlng, fichaMap.options.crs.scale(16), (results) => {
            if (results && results.length > 0) {
                document.getElementById('ficha-calle').value = results[0].name;
            } else {
                document.getElementById('ficha-calle').value = 'Dirección no encontrada';
            }
        });
    });

    // Invalidate size to ensure map renders correctly
    setTimeout(() => {
        if (fichaMap) fichaMap.invalidateSize();
    }, 100);
}

function placeMarker(lat, lng, address = '') {
    if (fichaMarker) {
        fichaMarker.setLatLng([lat, lng]);
    } else {
        fichaMarker = L.marker([lat, lng], { draggable: true }).addTo(fichaMap);
        fichaMarker.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            document.getElementById('coord-display').textContent = `Coordenadas: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
        });
    }
    document.getElementById('coord-display').textContent = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (address) document.getElementById('ficha-calle').value = address;
}

// ---- Save Ficha ----
async function handleSaveFicha() {
    // Revisores no pueden crear fichas nuevas, solo editar existentes
    if (editMode === 'revisor' && !currentFichaId) {
        showToast('Los revisores no pueden crear fichas nuevas', 'error');
        return;
    }

    const btnSave = document.getElementById('btn-ficha-save');
    const originalBtnText = btnSave.innerHTML;

    // 1. Prevenir múltiples clics
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    const folio = document.getElementById('ficha-folio').value.trim();
    const sifais = document.getElementById('ficha-sifais').value.trim();

    if (!folio || !sifais) {
        showToast('Folio y SIFAIS son obligatorios', 'error');
        btnSave.disabled = false;
        btnSave.innerHTML = originalBtnText;
        return;
    }

    // Validación de duplicados (solo para nuevas fichas)
    if (!currentFichaId) {
        try {
            const { data: existingFichas, error } = await db()
                .from('fichas')
                .select('id')
                .or(`folio.eq.${folio},sifais.eq.${sifais}`);

            if (error) throw error;

            if (existingFichas && existingFichas.length > 0) {
                showToast('Error: Ya existe una ficha con ese Folio o SIFAIS', 'error');
                btnSave.disabled = false;
                btnSave.innerHTML = originalBtnText;
                return;
            }
        } catch (err) {
            console.error('Error verificando duplicados:', err);
            // Continuar con el guardado si falla la verificación, pero loguear el error
        }
    }

    let lat, lng;
    if (fichaMarker) {
        // Si hay marcador, usar sus coordenadas
        const pos = fichaMarker.getLatLng();
        lat = pos.lat;
        lng = pos.lng;
    } else if (originalLat && originalLng) {
        // Si no hay marcador pero hay coordenadas originales, mantenerlas
        lat = originalLat;
        lng = originalLng;
    } else {
        // Si no hay ni marcador ni coordenadas originales, poner null
        lat = null;
        lng = null;
    }

    // Calcular porcentaje basado en infraestructura instalada (automático)
    // Usamos la función extraída para evitar duplicación
    const statusPercent = calculateInfrastructurePercent();

    let fichaData;

    if (editMode === 'revisor') {
        // Revisores solo pueden actualizar campos del Paso 3
        fichaData = {
            topografia: document.getElementById('ficha-topografia').value.trim(),
            mecanica: document.getElementById('ficha-mecanica-text').value.trim(),
            gas: parseInt(document.getElementById('ficha-gas').value) || 0,
            agua: parseInt(document.getElementById('ficha-agua').value) || 0,
            drenaje: parseInt(document.getElementById('ficha-drenaje').value) || 0,
            alumbrado: document.getElementById('ficha-alumbrado-text').value.trim(),
            via_ciclista: document.getElementById('ficha-via-ciclista-text').value.trim(),
            zap: document.getElementById('ficha-zap').value.trim(),
            definicion: document.getElementById('ficha-definicion').value.trim(),
            expediente: statusPercent,
            status_percent: statusPercent,
            updated_at: new Date().toISOString()
        };
    } else {
        // Administradores pueden actualizar todos los campos
        fichaData = {
            folio, sifais,
            tipo: document.getElementById('ficha-tipo').value.trim(),
            tiempo_ejecucion: document.getElementById('ficha-tiempo-ejecucion').value.trim(),
            concepto: document.getElementById('ficha-concepto').value.trim(),
            m2: parseFloat(document.getElementById('ficha-m2').value) || null,
            longitud: document.getElementById('ficha-longitud').value.trim(),
            costo_parametrico: document.getElementById('ficha-costo-parametrico').value.trim(),
            origen_recursos: document.getElementById('ficha-origen-recursos').value.trim(),
            anio: document.getElementById('ficha-anio').value ? parseInt(document.getElementById('ficha-anio').value) : null,
            lat, lng,
            calle: document.getElementById('ficha-calle').value.trim(),
            topografia: document.getElementById('ficha-topografia').value.trim(),
            mecanica: document.getElementById('ficha-mecanica-text').value.trim(),
            gas: parseInt(document.getElementById('ficha-gas').value) || 0,
            agua: parseInt(document.getElementById('ficha-agua').value) || 0,
            drenaje: parseInt(document.getElementById('ficha-drenaje').value) || 0,
            alumbrado: document.getElementById('ficha-alumbrado-text').value.trim(),
            via_ciclista: document.getElementById('ficha-via-ciclista-text').value.trim(),
            zap: document.getElementById('ficha-zap').value.trim(),
            definicion: document.getElementById('ficha-definicion').value.trim(),
            expediente: statusPercent,
            status_percent: statusPercent,
            updated_at: new Date().toISOString()
        };
    }

    // El porcentaje se calcula automáticamente basado en los checkboxes de infraestructura
    // Las columnas status_mecanica, status_gas, status_agua, status_drenaje ya no se envían

    try {
        let result;
        if (currentFichaId) {
            console.log('Actualizando ficha:', fichaData);
            result = await db().from('fichas').update(fichaData).eq('id', currentFichaId).select();
        } else {
            console.log('Creando ficha:', fichaData);
            fichaData.created_by = currentUser.id;
            // Solo establecer created_at si es nuevo (Supabase lo hará automáticamente si no se envía, pero por si acaso)
            fichaData.created_at = new Date().toISOString();
            result = await db().from('fichas').insert([fichaData]).select();
        }

        if (result.error) {
            console.error('Error de Supabase:', result.error);
            throw result.error;
        }

        // Obtener el ID de la ficha creada o actualizada
        const fichaId = currentFichaId || result.data[0].id;

        // Subir PDFs si hay archivos seleccionados (creación o edición)
        const pdfInput = document.getElementById('ficha-pdf-input');
        if (pdfInput && pdfInput.files.length > 0) {
            await uploadAndOptimizePDFs(fichaId, pdfInput.files);
        }

        // Mostrar animación de éxito
        showSuccessAnimation();

        // Cerrar modal después de un pequeño retraso para ver la animación
        setTimeout(() => {
            closeModal('modal-ficha');
            loadFichas(currentUser.role + '-fichas-grid');
        }, 1500); // 1.5 segundos para ver la animación

    } catch (err) {
        console.error('Error al guardar:', err);
        showToast('Error: ' + err.message, 'error');
        // Re-habilitar el botón en caso de error
        btnSave.disabled = false;
        btnSave.innerHTML = originalBtnText;
    }
}

// ---- Success Animation ----
function showSuccessAnimation() {
    // Crear overlay temporal para la animación
    const overlay = document.createElement('div');
    overlay.id = 'success-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const container = document.createElement('div');
    container.id = 'success-animation-container';
    container.style.width = '200px';
    container.style.height = '200px';

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Cargar animación success.json
    lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: 'assets/success.json'
    });

    // Eliminar overlay después de que la animación termine (44 frames a 30fps = ~1.5s)
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }, 2000);
}

// ---- Load Fichas ----
async function loadFichas(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Header row - siempre visible
    const headerHTML = `
        <div class="fichas-header">
            <div>Folio</div>
            <div>SIFAIS</div>
            <div>Obra / Tipo</div>
            <div>Fecha</div>
            <div>Avance</div>
            <div>Acciones</div>
        </div>
    `;

    grid.innerHTML = headerHTML + '<div class="empty-state"><p>Cargando...</p></div>';

    try {
        // Cargar fichas con conteo de comentarios
        const { data: fichas, error } = await db()
            .from('fichas')
            .select(`
                *,
                comentarios:comentarios(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Procesar fichas para incluir información de comentarios
        allFichas = (fichas || []).map(f => ({
            ...f,
            comments_count: f.comentarios ? f.comentarios.count : 0,
            has_comments: f.comentarios && f.comentarios.count > 0
        }));

        renderFichas(allFichas, gridId);
    } catch (err) {
        console.error('Error loading fichas:', err);
        grid.innerHTML = headerHTML + '<div class="empty-state"><p>Error de conexión</p></div>';
        console.error('Connection error loading fichas:', err);
    }
}

// ---- Ficha Detail ----
async function openFichaDetail(fichaId) {
    let ficha = allFichas.find(f => f.id === fichaId);

    // If ficha not found in allFichas, try to fetch it from the database
    if (!ficha) {
        try {
            const { data, error } = await db()
                .from('fichas')
                .select('*')
                .eq('id', fichaId)
                .single();

            if (error) {
                console.error('Error fetching ficha:', error);
                return;
            }
            ficha = data;
        } catch (err) {
            console.error('Error fetching ficha:', err);
            return;
        }
    }

    if (!ficha) return;

    // Formatear fecha de creación
    const fechaCreacion = ficha.created_at ? new Date(ficha.created_at).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'N/A';

    // Determinar clase de estado para el porcentaje
    const statusClass = ficha.status_percent >= 80 ? 'status-high' : ficha.status_percent >= 40 ? 'status-medium' : 'status-low';

    const content = document.getElementById('ficha-detail-content');
    content.innerHTML = `
        <div class="ficha-detail-grid">
            <div class="detail-item"><div class="label">Folio</div><div class="value">${ficha.folio}</div></div>
            <div class="detail-item"><div class="label">SIFAIS</div><div class="value">${ficha.sifais}</div></div>
            <div class="detail-item"><div class="label">Fecha Creación</div><div class="value">${fechaCreacion}</div></div>
            <div class="detail-item"><div class="label">Año</div><div class="value">${ficha.anio || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Tipo</div><div class="value">${ficha.tipo || 'N/A'}</div></div>
            <div class="detail-item full-width"><div class="label">Obra/Proyecto</div><div class="value">${ficha.concepto || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">M²</div><div class="value">${ficha.m2 || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Longitud</div><div class="value">${ficha.longitud || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Costo Param.</div><div class="value">${ficha.costo_parametrico || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Dirección</div><div class="value">${ficha.calle || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Status</div><div class="value ${statusClass}">${ficha.status_percent}%</div></div>
            <div class="detail-item"><div class="label">Expediente</div><div class="value">${ficha.expediente || 'N/A'}</div></div>
            
            <div class="detail-item full-width"><div class="label">Infraestructura</div>
                <div class="infra-list">
                    ${ficha.topografia ? `<span class="infra-tag">Topografía: ${ficha.topografia}</span>` : ''}
                    ${ficha.mecanica ? `<span class="infra-tag">Mecánica: ${ficha.mecanica}</span>` : ''}
                    ${ficha.gas ? `<span class="infra-tag">Gas: ${ficha.gas}%</span>` : ''}
                    ${ficha.agua ? `<span class="infra-tag">Agua: ${ficha.agua}%</span>` : ''}
                    ${ficha.drenaje ? `<span class="infra-tag">Drenaje: ${ficha.drenaje}%</span>` : ''}
                    ${ficha.alumbrado ? `<span class="infra-tag">Alumbrado: ${ficha.alumbrado}</span>` : ''}
                    ${ficha.via_ciclista ? `<span class="infra-tag">Vía Ciclista: ${ficha.via_ciclista}</span>` : ''}
                </div>
            </div>
            
            <div class="detail-item"><div class="label">ZAP</div><div class="value">${ficha.zap || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Origen</div><div class="value">${ficha.origen_recursos || 'N/A'}</div></div>
            <div class="detail-item full-width"><div class="label">Definición</div><div class="value">${ficha.definicion || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Tiempo Ejecución</div><div class="value">${ficha.tiempo_ejecucion || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Latitud</div><div class="value">${ficha.lat || 'N/A'}</div></div>
            <div class="detail-item"><div class="label">Longitud</div><div class="value">${ficha.lng || 'N/A'}</div></div>
            
            <!-- Sección de PDFs anexados -->
            <div class="detail-item full-width" id="pdfs-section" style="display: none;">
                <div class="label">Documentos Anexos (PDF)</div>
                <div class="value" id="pdfs-list"></div>
            </div>
        </div>
    `;

    document.getElementById('detail-title').textContent = `Ficha: ${ficha.folio}`;

    // Footer Actions
    const footer = document.getElementById('detail-footer-actions');
    footer.innerHTML = '';
    if (currentUser.role === 'admin') {
        footer.innerHTML = `
            <button class="btn btn-secondary" data-close="modal-ficha-detail">Cerrar</button>
            <button class="btn btn-primary" onclick="editFicha('${ficha.id}', 'admin')"><i class="fas fa-edit"></i> Editar</button>
        `;
        footer.querySelector('[data-close]').addEventListener('click', () => closeModal('modal-ficha-detail'));
    } else if (currentUser.role === 'revisor') {
        footer.innerHTML = `
            <button class="btn btn-secondary" data-close="modal-ficha-detail">Cerrar</button>
            <button class="btn btn-primary" onclick="editFicha('${ficha.id}', 'revisor')"><i class="fas fa-edit"></i> Editar Detalles</button>
        `;
        footer.querySelector('[data-close]').addEventListener('click', () => closeModal('modal-ficha-detail'));
    } else {
        footer.innerHTML = `<button class="btn btn-secondary" data-close="modal-ficha-detail">Cerrar</button>`;
        footer.querySelector('[data-close]').addEventListener('click', () => closeModal('modal-ficha-detail'));
    }

    // Comment Form Visibility
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        // Todos los roles pueden comentar (Admin, Revisor, Visor)
        commentForm.style.display = 'block';
    }
    document.getElementById('btn-submit-comment').dataset.fichaId = fichaId;

    await loadComments(fichaId);

    // Load PDFs attached to this ficha
    try {
        const [archivosResult, usuariosResult] = await Promise.all([
            db().from('archivos_ficha').select('*').eq('ficha_id', fichaId).order('created_at', { ascending: false }),
            db().from('usuarios').select('id, username')
        ]);

        const archivos = archivosResult.data;
        const error = archivosResult.error;
        const usuarios = usuariosResult.data || [];

        if (error) throw error;

        // Crear un mapa de usuarios para acceso rápido (usando username)
        const userMap = new Map(usuarios.map(u => [u.id, u.username]));
        console.log('Usuarios cargados para mapeo (detalle):', userMap);

        if (archivos && archivos.length > 0) {
            const pdfSection = document.getElementById('pdfs-section');
            const pdfList = document.getElementById('pdfs-list');

            pdfSection.style.display = 'block';

            let pdfHTML = '<div class="pdf-detail-list">';
            archivos.forEach(arch => {
                const sizeKB = (arch.peso_optimizado / 1024).toFixed(1);
                const userName = arch.usuario_id ? (userMap.get(arch.usuario_id) || 'Usuario desconocido') : 'Usuario desconocido';
                const uploadDate = new Date(arch.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                pdfHTML += `
                    <div class="pdf-detail-item">
                        <div class="pdf-info">
                            <i class="fas fa-file-pdf"></i>
                            <div class="pdf-details">
                                <span class="pdf-name">${arch.nombre_original}</span>
                                <span class="pdf-meta">${userName} • ${uploadDate} • ${sizeKB} KB</span>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-secondary" onclick="downloadPDF('${arch.nombre_optimizado}')">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                `;
            });
            pdfHTML += '</div>';

            pdfList.innerHTML = pdfHTML;
        }
    } catch (err) {
        console.error('Error loading PDFs:', err);
    }

    openModal('modal-ficha-detail');

    // Initialize Detail Map
    setTimeout(() => initDetailMap(ficha), 300);
}

function editFicha(fichaId, mode) {
    const ficha = allFichas.find(f => f.id === fichaId);
    if (!ficha) return;
    closeModal('modal-ficha-detail');
    setTimeout(() => openFichaModal(ficha, mode), 300);
}

function downloadPDF(fileName) {
    const { data, error } = supabaseClient.storage
        .from('archivos_ficha')
        .getPublicUrl(fileName);

    if (error) {
        console.error('Error obteniendo URL:', error);
        showToast('Error al descargar archivo', 'error');
        return;
    }

    // Crear enlace temporal para descargar
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function initDetailMap(ficha) {
    const mapEl = document.getElementById('detail-map');
    if (!mapEl) return;

    if (detailMap) { detailMap.remove(); detailMap = null; }

    const lat = ficha.lat || 19.4326;
    const lng = ficha.lng || -99.1332;
    const zoom = ficha.lat ? 15 : 6;

    detailMap = L.map('detail-map').setView([lat, lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
    }).addTo(detailMap);

    if (ficha.lat && ficha.lng) {
        L.marker([ficha.lat, ficha.lng]).addTo(detailMap)
            .bindPopup(`<strong>${ficha.folio}</strong><br>${ficha.calle || ''}`).openPopup();
    }
}

// ---- Comments ----
async function loadComments(fichaId) {
    const container = document.getElementById('comments-list');
    container.innerHTML = '<p>Cargando comentarios...</p>';

    try {
        const { data: comments, error } = await db()
            .from('comentarios')
            .select('*, usuarios(nombre)')
            .eq('ficha_id', fichaId)
            .order('created_at', { ascending: false });

        if (error || !comments || comments.length === 0) {
            container.innerHTML = '<p style="color:rgba(255,255,255,0.5)">Sin comentarios aún</p>';
            return;
        }

        const tipoLabels = { aprobacion: 'Aprobación', revision: 'Revisión', datos_incorrectos: 'Datos Incorrectos' };
        container.innerHTML = comments.map(c => {
            const isCurrentUser = c.usuario_id === currentUser.id;
            const alignmentClass = isCurrentUser ? 'comment-right' : 'comment-left';
            const colorClass = isCurrentUser ? 'comment-current-user' : 'comment-other-user';
            
            return `
                <div class="comment-card tipo-${c.tipo} ${alignmentClass} ${colorClass}">
                    <div class="comment-meta">
                        <span>${c.usuarios?.nombre || 'Usuario'} - ${new Date(c.created_at).toLocaleString('es-MX')}</span>
                        <span class="comment-tipo tipo-${c.tipo}">${tipoLabels[c.tipo]}</span>
                    </div>
                    <div>${c.texto}</div>
                </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = '<p>Error al cargar comentarios</p>';
    }
}

async function handleSubmitComment() {
    const texto = document.getElementById('comment-text').value.trim();
    const fichaId = document.getElementById('btn-submit-comment').dataset.fichaId;

    if (!texto || !selectedCommentType) {
        showToast('Escribe un comentario y selecciona el tipo', 'error');
        return;
    }

    try {
        const { error } = await db()
            .from('comentarios')
            .insert([{ ficha_id: fichaId, usuario_id: currentUser.id, texto, tipo: selectedCommentType }]);

        if (error) throw error;

        showToast('Comentario enviado', 'success');
        document.getElementById('comment-text').value = '';
        document.querySelectorAll('.comment-type-btn').forEach(b => b.classList.remove('selected'));
        selectedCommentType = null;
        await loadComments(fichaId);
        loadFichas(currentUser.role + '-fichas-grid'); // Reload grid to update colors
        // Update comments count for admin badge
        if (currentUser.role === 'admin') {
            loadCommentsCount();
        }
    } catch (err) {
        showToast('Error al enviar comentario', 'error');
    }
}

// ---- Reports ----
async function openReport() {
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">Cargando...</td></tr>';
    openModal('modal-report');

    // Cargar imagen de fondo dinámicamente
    const reportContainer = document.querySelector('.report-container');
    if (reportContainer) {
        // Intentar diferentes rutas
        const possiblePaths = [
            'assets/Plantilla.png',
            './assets/Plantilla.png',
            '../assets/Plantilla.png',
            `${window.location.origin}/assets/Plantilla.png`,
            `file:///C:/Users/aranc/Documents/Sistema_Edgar/assets/Plantilla.png`
        ];

        let imagePath = '';
        let imgLoaded = false;

        function tryLoadImage(index) {
            if (index >= possiblePaths.length) {
                console.log('Nose pudo cargar la imagen,l utilizams el color balnco como respaldo');
                reportContainer.style.background = '#f8f9fa';
                return;
            }
            imagePath = possiblePaths[index];
            console.log(`Estamos intentando cargar la imagen, espera un momento: ${imagePath}`);

            const img = new Image();
            img.onload = function () {
                console.log(`Imagen cargada correctamente: ${imagePath}`);
                reportContainer.style.backgroundImage = `url('${imagePath}')`;
                imgLoaded = true;
            };
            img.onerror = function () {
                console.log(`Hubo un error al cargar la ruta: ${imagePath}`);
                tryLoadImage(index + 1);
            };
            img.src = imagePath;
        }

        tryLoadImage(0);
    }

    try {
        const { data: fichas, error } = await db().from('fichas').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        tbody.innerHTML = fichas.map(f => {
            // Determinar color de fila basado en porcentaje
            let rowClass = '';
            if (f.status_percent === 100) rowClass = 'estado-finalizado';
            else if (f.status_percent >= 80) rowClass = 'estado-proceso';
            else rowClass = 'estado-rezagado';

            // Obtener tipo del campo correspondiente
            let tipo = f.tipo || 'N/A';

            // Determinar color del círculo de expediente
            const expedienteValue = f.expediente || 0;
            let circleColor = '#dc3545'; // Rojo por defecto
            if (expedienteValue === 100) circleColor = '#28a745'; // Verde
            else if (expedienteValue >= 80) circleColor = '#ffc107'; // Amarillo

            return `
            <tr class="${rowClass}">
                <td>${tipo}</td>
                <td>
                    <div class="expediente-circle" style="background-color: ${circleColor};"></div>
                    <span class="expediente-value">${expedienteValue}%</span>
                </td>
                <td>${f.calle || 'N/A'}</td>
                <td>${f.topografia ? 'Si' : 'No'}</td>
                <td>${f.mecanica ? 'Si' : 'No'}</td>
                <td>${f.concepto || 'N/A'}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">Error inesperado al cargar el reporte</td></tr>';
    }
}

function printReport() {
    const tableElement = document.getElementById('report-table');
    const tbody = tableElement.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    const w = window.open('', '_blank');
    const styles = `
    <style>
        @page {
            margin: 0;
            size: 8.89in 5in; /* 1280x720 píxeles a 144 DPI */
        }
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #fff;
            width: 8.89in;
            height: 5in;
            overflow: hidden;
        }
        .page {
            width: 100%;
            height: 100%;
            position: relative;
            background-image: url('assets/Plantilla.png');
            background-size: cover;
            background-repeat: no-repeat;
            background-position: center;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .table-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            overflow: hidden;
        }
        .report-title {
            text-align: center;
            margin-bottom: 15px;
            color: white;
            text-shadow: 2px 2px 4px black;
            font-size: 22px;
            font-weight: bold;
            flex-shrink: 0;
        }
        .table-wrapper {
            transform: scale(0.7);
            transform-origin: center;
            width: 143%;
            height: 143%;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            margin: 0 auto;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px 10px;
            text-align: center;
        }
        td:nth-child(6) {
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        th {
            background-color: #7d2447;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background: rgba(255, 255, 255, 0.7);
        }
        .estado-finalizado { background-color: #d4edda !important; }
        .estado-proceso { background-color: #fff3cd !important; }
        .estado-rezagado { background-color: #f8d7da !important; }
        
        /* Círculos de expediente */
        .expediente-circle {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 5px;
            vertical-align: middle;
            border: 1px solid #ccc;
        }
        .expediente-value {
            font-weight: bold;
        }
        
        /* Forzar que el fondo se muestre en la vista previa de impresión */
        @media print {
            .page {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>`;

    // Crear contenido para múltiples páginas
    const maxRowsPerPage = 5; // Exactamente 5 filas por página (plantilla)
    let pagesHTML = '';

    for (let i = 0; i < rows.length; i += maxRowsPerPage) {
        const pageRows = rows.slice(i, i + maxRowsPerPage);
        const tableHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Expediente</th>
                    <th>Ubicación</th>
                    <th>Topografía</th>
                    <th>Mecánica</th>
                    <th>Obra/Proyecto</th>
                </tr>
            </thead>
            <tbody>
                ${pageRows.map(row => row.outerHTML).join('')}
            </tbody>
        </table>`;

        // Encabezado fuera de la plantilla (posición fija superior)
        const headerHTML = `
        <div style="position: fixed; top: 10px; left: 10px; z-index: 20; background: rgba(255,255,255,0.8); padding: 5px 10px; border-radius: 5px; display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: bold; color: #7d2447; font-size: 16px;">Todas las Fichas ${i > 0 ? `(Página ${Math.floor(i / maxRowsPerPage) + 1})` : ''}</span>
            <button onclick="window.print()" style="background: #7d2447; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 14px;">
                <i class="fas fa-print"></i> Imprimir
            </button>
        </div>`;

        // Título centrado dentro de la plantilla
        const titleHTML = `
        <div class="report-title">
            REPORTE GENERAL
        </div>`;

        pagesHTML += `
        ${headerHTML}
        <div class="page">
            <div class="table-container">
                ${titleHTML}
                <div class="table-wrapper">
                    ${tableHTML}
                </div>
            </div>
        </div>`;
    }

    w.document.write(`
    <html>
    <head>
        <title>Reporte General</title>
        ${styles}
    </head>
    <body>
        ${pagesHTML}
    </body>
    </html>`);
    w.document.close();
    w.print();
}

// ---- Export to PowerPoint ----
function exportToPowerPoint() {
    const tableElement = document.getElementById('report-table');
    const tbody = tableElement.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Crear contenido HTML para PowerPoint
    let tableRowsHTML = '';
    rows.forEach(row => {
        tableRowsHTML += row.outerHTML;
    });

    const pptContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Reporte General - PowerPoint</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                margin: 20px;
                background: white;
            }
            h1 {
                color: #7d2447;
                text-align: center;
                margin-bottom: 30px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 0 auto;
                page-break-inside: avoid;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 10px;
                text-align: center;
                font-size: 14px;
            }
            th {
                background-color: #7d2447;
                color: white;
                font-weight: bold;
            }
            tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .page-break {
                page-break-before: always;
            }
        </style>
    </head>
    <body>
        <h1>REPORTE GENERAL</h1>
        <table>
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Expediente</th>
                    <th>Ubicación</th>
                    <th>Topografía</th>
                    <th>Mecánica</th>
                    <th>Obra/Proyecto</th>
                </tr>
            </thead>
            <tbody>
                ${tableRowsHTML}
            </tbody>
        </table>
    </body>
    </html>`;

    // Crear blob y descargar archivo
    const blob = new Blob([pptContent], { type: 'application/vnd.ms-powerpoint' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reporte_General.ppt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Archivo PowerPoint exportado exitosamente', 'success');
}

// ---- Export Functions ----
function exportToPDF(buttonId) {
    try {
        // Determinar qué perfil está usando
        let perfil = 'admin';
        if (buttonId.includes('revisor')) perfil = 'revisor';
        else if (buttonId.includes('visor')) perfil = 'visor';

        // Obtener las fichas del perfil actual
        const fichas = allFichas; // Usamos todas las fichas cargadas

        if (fichas.length === 0) {
            showToast('No hay fichas para exportar', 'warning');
            return;
        }

        // Verificar si jsPDF está cargado
        if (!window.jspdf) {
            showToast('La librería PDF no está cargada', 'error');
            return;
        }

        // Crear documento PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape', 'mm', 'a4');

        // Título
        doc.setFontSize(18);
        doc.setTextColor(125, 36, 71);
        doc.text('REPORTE DE FICHAS TÉCNICAS', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

        // Fecha
        doc.setFontSize(10);
        doc.setTextColor(100);
        const fecha = new Date().toLocaleDateString('es-ES');
        doc.text(`Generado: ${fecha}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

        // Preparar datos para la tabla
        const tableData = fichas.map((f, index) => [
            index + 1,
            f.sifais || 'N/A',
            f.tipo || 'N/A',
            (f.concepto || '').substring(0, 50) + (f.concepto && f.concepto.length > 50 ? '...' : ''),
            f.tiempo_ejecucion || 'N/A',
            f.longitud || 'N/A',
            f.m2 || 'N/A',
            f.calle || 'N/A',
            f.lng || 'N/A',
            f.lat || 'N/A',
            f.topografia || 'N/A',
            f.mecanica || 'N/A',
            f.gas || 'N/A',
            f.agua || 'N/A',
            f.drenaje || 'N/A',
            f.alumbrado || 'N/A',
            f.via_ciclista || 'N/A',
            f.zap || 'N/A',
            f.costo_parametrico || 'N/A',
            (f.definicion || '').substring(0, 30) + (f.definicion && f.definicion.length > 30 ? '...' : ''),
            f.expediente || 'N/A'
        ]);

        // Cabeceras de la tabla
        const tableHeaders = [
            'No.', 'No-SIFAIS', 'TIPO', 'OBRA/PROYECTO', 'TIEMPO EJEC.', 'LONGITUD', 'M2',
            'CALLE', 'LONG.', 'LAT.', 'TOPOGR.', 'MEC.', 'GAS', 'AGUA', 'DREN.',
            'ALUM.', 'VÍA CIC.', 'ZAP', 'COSTO', 'DEFINICIÓN', 'EXPED.'
        ];

        // Generar tabla
        doc.autoTable({
            head: [tableHeaders],
            body: tableData,
            startY: 30,
            theme: 'striped',
            headStyles: {
                fillColor: [125, 36, 71],
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240]
            },
            margin: { top: 30 },
            styles: {
                fontSize: 7,
                cellPadding: 2
            },
            columnStyles: {
                0: { cellWidth: 10 }, // No.
                1: { cellWidth: 15 }, // No-SIFAIS
                2: { cellWidth: 12 }, // TIPO
                3: { cellWidth: 30 }, // CONCEPTO
                4: { cellWidth: 15 }, // TIEMPO EJEC.
                5: { cellWidth: 12 }, // LONGITUD
                6: { cellWidth: 10 }, // M2
                7: { cellWidth: 15 }, // CALLE
                8: { cellWidth: 12 }, // LONG.
                9: { cellWidth: 12 }, // LAT.
                10: { cellWidth: 10 }, // TOPOGR.
                11: { cellWidth: 10 }, // MEC.
                12: { cellWidth: 10 }, // GAS
                13: { cellWidth: 10 }, // AGUA
                14: { cellWidth: 10 }, // DREN.
                15: { cellWidth: 10 }, // ALUM.
                16: { cellWidth: 12 }, // VÍA CIC.
                17: { cellWidth: 10 }, // ZAP
                18: { cellWidth: 15 }, // COSTO
                19: { cellWidth: 25 }, // DEFINICIÓN
                20: { cellWidth: 10 }  // EXPED.
            }
        });

        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(
                `Página ${i} de ${pageCount}`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }

        // Descargar PDF
        doc.save(`Fichas_Tecnicas_${perfil}_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('PDF exportado exitosamente', 'success');

    } catch (err) {
        console.error('Error exportando PDF:', err);
        showToast('Error al exportar PDF', 'error');
    }
}

function exportToExcel(buttonId) {
    try {
        // Determinar qué perfil está usando
        let perfil = 'admin';
        if (buttonId.includes('revisor')) perfil = 'revisor';
        else if (buttonId.includes('visor')) perfil = 'visor';

        // Obtener las fichas del perfil actual
        const fichas = allFichas;

        if (fichas.length === 0) {
            showToast('No hay fichas para exportar', 'warning');
            return;
        }

        // Preparar datos para Excel
        const tableData = fichas.map((f, index) => ({
            'No.': index + 1,
            'No-SIFAIS': f.sifais || 'N/A',
            'TIPO': f.tipo || 'N/A',
            'OBRA/PROYECTO': f.concepto || 'Sin concepto',
            'TIEMPO EJECUCIÓN': f.tiempo_ejecucion || 'N/A',
            'LONGITUD': f.longitud || 'N/A',
            'M2': f.m2 || 'N/A',
            'CALLE': f.calle || 'N/A',
            'LONGITUD (Lng)': f.lng || 'N/A',
            'LATITUD (Lat)': f.lat || 'N/A',
            'TOPOGRAFIA': f.topografia || 'N/A',
            'MECANICA': f.mecanica || 'N/A',
            'GAS': f.gas || 'N/A',
            'AGUA': f.agua || 'N/A',
            'DRENAJE': f.drenaje || 'N/A',
            'ALUMBRADO': f.alumbrado || 'N/A',
            'VIA CICLISTA': f.via_ciclista || 'N/A',
            'ZAP': f.zap || 'N/A',
            'COSTO PARAMETRICO': f.costo_parametrico || 'N/A',
            'DEFINICIÓN': f.definicion || 'N/A',
            'EXPEDIENTE': f.expediente || 'N/A'
        }));

        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();

        // Crear hoja
        const ws = XLSX.utils.json_to_sheet(tableData);

        // Ajustar anchos de columna
        const columnWidths = [
            { wch: 5 },  // No.
            { wch: 15 }, // No-SIFAIS
            { wch: 10 }, // TIPO
            { wch: 50 }, // CONCEPTO
            { wch: 15 }, // TIEMPO EJEC.
            { wch: 12 }, // LONGITUD
            { wch: 8 },  // M2
            { wch: 20 }, // CALLE
            { wch: 12 }, // LONGITUD
            { wch: 12 }, // LATITUD
            { wch: 10 }, // TOPOGRAFIA
            { wch: 10 }, // MECANICA
            { wch: 8 },  // GAS
            { wch: 8 },  // AGUA
            { wch: 10 }, // DRENAJE
            { wch: 10 }, // ALUMBRADO
            { wch: 12 }, // VIA CICLISTA
            { wch: 10 }, // ZAP
            { wch: 20 }, // COSTO PARAMETRICO
            { wch: 40 }, // DEFINICIÓN
            { wch: 10 }  // EXPEDIENTE
        ];
        ws['!cols'] = columnWidths;

        // Agregar la hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Fichas Técnicas');

        // Descargar archivo
        const fileName = `Fichas_Tecnicas_${perfil}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showToast('Excel exportado exitosamente', 'success');

    } catch (err) {
        console.error('Error exportando Excel:', err);
        showToast('Error al exportar Excel', 'error');
    }
}

// ---- Tutorial ----

function showTutorial() {
    openModal('modal-tutorial-1');
    initRobotAnimation('robot-animation-1');
}

function nextTutorialStep(step) {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    openModal(`modal-tutorial-${step}`);
    initRobotAnimation(`robot-animation-${step}`);
}

function prevTutorialStep(step) {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    openModal(`modal-tutorial-${step}`);
    initRobotAnimation(`robot-animation-${step}`);
}

function closeTutorial() {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    setTimeout(() => {
        navigateToDashboard();
    }, 500);
}

function showTutorialRevisor() {
    openModal('modal-tutorial-revisor-1');
    initRobotAnimation('robot-animation-revisor-1');
}

function nextRevisorStep(step) {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    openModal(`modal-tutorial-revisor-${step}`);
    initRobotAnimation(`robot-animation-revisor-${step}`);
}

function prevRevisorStep(step) {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    openModal(`modal-tutorial-revisor-${step}`);
    initRobotAnimation(`robot-animation-revisor-${step}`);
}

function closeTutorialRevisor() {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    setTimeout(() => {
        navigateToDashboard();
    }, 500);
}

function showTutorialVisor() {
    openModal('modal-tutorial-visor-1');
    initRobotAnimation('robot-animation-visor-1');
}

function nextVisorStep(step) {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    openModal(`modal-tutorial-visor-${step}`);
    initRobotAnimation(`robot-animation-visor-${step}`);
}

function prevVisorStep(step) {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    openModal(`modal-tutorial-visor-${step}`);
    initRobotAnimation(`robot-animation-visor-${step}`);
}

function closeTutorialVisor() {
    document.querySelectorAll('.tutorial-overlay').forEach(m => m.classList.remove('active'));
    setTimeout(() => {
        navigateToDashboard();
    }, 500);
}

function initRobotAnimation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    lottie.loadAnimation({
        container: container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: 'assets/SEMOVINFRITA.json'
    });
}

// ---- Lottie ----
function initLottieAnimation() {
    const container = document.getElementById('lottie-container');
    if (!container) {
        console.log('Contenedor de animación no encontrado');
        return;
    }

    console.log('Inicializando animación Lottie...');

    // Obtener la ruta base del documento actual
    const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
    const animationPath = baseUrl + '/assets/Edificios.json';

    console.log('Ruta de animación:', animationPath);

    try {
        const animation = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: animationPath
        });

        animation.addEventListener('DOMLoaded', function () {
            console.log('Animación cargada correctamente');
        });

        animation.addEventListener('error', function (error) {
            console.error('Error en animación:', error);
        });
    } catch (error) {
        console.error('Error al cargar animación:', error);
    }
}

// ---- Loading Screen ----
function showLoadingScreen(callback) {
    const loadingView = document.getElementById('loading-view');
    const container = document.getElementById('welcome-animation-container');

    if (!loadingView || !container) {
        console.error('Contenedor de pantalla de carga no encontrado');
        if (callback) callback();
        return;
    }

    console.log('Mostrando pantalla de carga...');

    // Clear previous animation
    container.innerHTML = '';

    // Show loading view
    loadingView.classList.add('active');

    // Load Welcome animation
    try {
        // Construct absolute path to ensure it works regardless of current URL
        const baseUrl = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const animationPath = baseUrl + '/assets/Welcome.json';

        console.log('Ruta de animación de bienvenida:', animationPath);

        const animation = lottie.loadAnimation({
            container: container,
            renderer: 'svg',
            loop: false, // No loop, just play once
            autoplay: true,
            path: animationPath
        });

        // Detener animación en frame 240 (4 segundos a 60fps)
        let stoppedAtFrame240 = false;
        animation.addEventListener('enterFrame', function (e) {
            if (!stoppedAtFrame240 && e.currentTime >= 240) { // 240 frames = 4 segundos a 60fps
                stoppedAtFrame240 = true;
                animation.pause();
                console.log('Animación detenida en frame 240');
                // Ocultar pantalla de carga inmediatamente
                setTimeout(() => {
                    console.log('Ocultando pantalla de carga y ejecutando callback...');
                    loadingView.classList.remove('active');
                    if (callback) callback();
                }, 100); // Pequeño delay para asegurar que se detenga
            }
        });

        // Fallback: si la animación completa antes (por si acaso)
        animation.addEventListener('complete', function () {
            console.log('Animación completada antes de frame 240');
            setTimeout(() => {
                console.log('Ocultando pantalla de carga y ejecutando callback...');
                loadingView.classList.remove('active');
                if (callback) callback();
            }, 100);
        });

        animation.addEventListener('error', function (error) {
            console.error('Error en animación de bienvenida:', error);
            console.log('Ocultando pantalla de carga por error, esperando 3 segundos...');
            // If animation fails, still proceed after 3 seconds
            setTimeout(() => {
                console.log('Ocultando pantalla de carga y ejecutando callback...');
                loadingView.classList.remove('active');
                if (callback) callback();
            }, 3000);
        });
    } catch (error) {
        console.error('Error al cargar animación de bienvenida:', error);
        console.log('Ocultando pantalla de carga por excepción, esperando 3 segundos...');
        // If error, still proceed after 3 seconds
        setTimeout(() => {
            console.log('Ocultando pantalla de carga y ejecutando callback...');
            loadingView.classList.remove('active');
            if (callback) callback();
        }, 3000);
    }
}

// ---- Utilities ----
function showToast(message, type = 'info') {
    // Redirigir a la Isla Dinámica
    showDynamicIsland(message, type);
}

// ---- Realtime (WebSockets) ----
let realtimeChannel = null;

function initRealtime() {
    if (!supabaseClient) return;

    // Suscribirse al canal de Realtime
    // Usamos el channel 'realtime' para escuchar cambios en la BD
    realtimeChannel = supabaseClient
        .channel('realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fichas' }, (payload) => {
            handleFichaChange(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios' }, (payload) => {
            handleComentarioChange(payload);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Conectado a Realtime');
            }
        });
}

function handleFichaChange(payload) {
    console.log('Cambio en fichas detectado:', payload);
    
    const role = currentUser ? currentUser.role : null;
    
    // No recargar si el modal de edición de ficha está abierto
    const modalFicha = document.getElementById('modal-ficha');
    if (modalFicha && modalFicha.classList.contains('active')) {
        console.log('Modal de edición abierto, ignorando actualización de grid');
        return;
    }

    // Si soy Revisor o Visor, recargar el grid correspondiente
    if (role === 'revisor') {
        loadFichas('revisor-fichas-grid');
    } else if (role === 'visor') {
        loadFichas('visor-fichas-grid');
    }
}

function handleComentarioChange(payload) {
    console.log('Cambio en comentarios detectado:', payload);
    
    // Si es una inserción (nuevo comentario)
    if (payload.eventType === 'INSERT') {
        // Verificar si el comentario es del usuario actual
        const isMyComment = payload.new.usuario_id === (currentUser ? currentUser.id : null);
        
        // Mostrar notificación a TODOS excepto al emisor
        if (!isMyComment) {
            showToast('Nuevo mensaje recibido', 'info');
        }
        
        // Actualizar contador para TODOS los usuarios (siempre que no sea su propio comentario)
        if (!isMyComment && currentUser) {
            // Llamar a la función de carga de contador correspondiente al rol
            if (currentUser.role === 'admin') {
                loadCommentsCount();
            } else if (currentUser.role === 'revisor') {
                loadCommentsCountRevisor();
            } else if (currentUser.role === 'visor') {
                loadCommentsCountVisor();
            }
        }
        
        // Si el dropdown está abierto, recargarlo para mostrar el nuevo mensaje
        const dropdown = document.getElementById('messages-dropdown');
        const isDropdownOpen = dropdown && dropdown.classList.contains('open');
        
        if (isDropdownOpen) {
            loadCommentsDropdown(null);
        }
    }
}

// Global functions for onclick handlers
window.openFichaDetail = openFichaDetail;
window.editFicha = editFicha;
window.nextTutorialStep = nextTutorialStep;
window.prevTutorialStep = prevTutorialStep;
window.closeTutorial = closeTutorial;
window.searchFichas = searchFichas;
window.clearSearch = clearSearch;
window.toggleMessagesDropdown = toggleMessagesDropdown;
window.deletePDF = deletePDF;

// Search Functions
function searchFichas(profile) {
    const searchTerm = document.getElementById(`search-${profile}`).value.toLowerCase().trim();
    const searchType = document.getElementById(`search-type-${profile}`).value;
    const gridId = `${profile}-fichas-grid`;
    const grid = document.getElementById(gridId);

    if (!searchTerm) {
        loadFichas(gridId);
        return;
    }

    // Filter allFichas based on search type
    let filteredFichas = [];

    if (searchType === 'folio') {
        filteredFichas = allFichas.filter(f => f.folio && f.folio.toLowerCase().includes(searchTerm));
    } else if (searchType === 'sifais') {
        filteredFichas = allFichas.filter(f => f.sifais && f.sifais.toLowerCase().includes(searchTerm));
    } else if (searchType === 'year') {
        // Buscar por año (campo anio)
        filteredFichas = allFichas.filter(f => {
            if (!f.anio) return false;
            return f.anio.toString().includes(searchTerm);
        });
    }

    // Render filtered fichas
    if (filteredFichas.length === 0) {
        // Mantener el encabezado y mostrar mensaje de "no results"
        const headerHTML = `
            <div class="fichas-header">
                <div>Folio</div>
                <div>SIFAIS</div>
                <div>Obra / Tipo</div>
                <div>Año</div>
                <div>Avance</div>
                <div>Acciones</div>
            </div>
        `;
        grid.innerHTML = headerHTML + '<div class="empty-state"><p>No se encontraron fichas</p></div>';
        return;
    }

    renderFichas(filteredFichas, gridId);
}

function clearSearch(profile) {
    document.getElementById(`search-${profile}`).value = '';
    loadFichas(`${profile}-fichas-grid`);
}

function renderFichas(fichas, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Header row - siempre visible
    const headerHTML = `
        <div class="fichas-header">
            <div>Folio</div>
            <div>SIFAIS</div>
            <div>Obra / Tipo</div>
            <div>Año</div>
            <div>Avance</div>
            <div>Acciones</div>
        </div>
    `;

    if (fichas.length === 0) {
        grid.innerHTML = headerHTML + '<div class="empty-state"><p>No hay fichas registradas</p></div>';
        return;
    }

    const cardsHTML = fichas.map(f => {
        const statusClass = f.status_percent >= 80 ? 'status-high' : f.status_percent >= 40 ? 'status-medium' : 'status-low';
        const tipoDisplay = f.tipo ? ` • ${f.tipo}` : '';

        // Formatear fecha
        const fechaDisplay = f.created_at ? new Date(f.created_at).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : '';

        return `
        <div class="ficha-card ${statusClass}" onclick="openFichaDetail('${f.id}')">
            <div class="folio">
                <span class="status-indicator"></span>${f.folio}
            </div>
            <div class="sifais">${f.sifais}</div>
            <div class="concepto">
                ${f.concepto || 'Sin concepto'}
                <span class="tipo-badge">${tipoDisplay}</span>
            </div>
            <div class="anio-cell">${f.anio || '-'}</div>
            <div class="status-cell">
                <div class="status-percent">${f.status_percent}%</div>
                <div class="status-bar">
                    <div class="status-fill" style="width: ${f.status_percent}%"></div>
                </div>
            </div>
            <div class="actions-cell">
                <button class="view-btn" onclick="event.stopPropagation(); openFichaDetail('${f.id}')">
                    <i class="fas fa-eye"></i> Ver
                </button>
            </div>
        </div>`;
    }).join('');

    grid.innerHTML = headerHTML + cardsHTML;
}



// ---- Messages/Comments Button (Admin only) ----

let commentsDropdownOpen = false;

function toggleMessagesDropdown() {
    console.log('toggleMessagesDropdown llamada');
    const dropdown = document.getElementById('messages-dropdown');
    if (!dropdown) {
        console.log('Creando dropdown...');
        createMessagesDropdown();
    }

    commentsDropdownOpen = !commentsDropdownOpen;
    const dropdownElement = document.getElementById('messages-dropdown');
    if (dropdownElement) {
        console.log('Mostrando dropdown:', commentsDropdownOpen);
        if (commentsDropdownOpen) {
            dropdownElement.classList.add('open');
        } else {
            dropdownElement.classList.remove('open');
        }

        // Si se está abriendo, cargar los comentarios y ocultar el badge
        if (commentsDropdownOpen) {
            console.log('Cargando comentarios en dropdown...');
            // Ocultar el badge cuando se abren los mensajes
            const role = currentUser ? currentUser.role : null;
            let badge;
            if (role === 'visor') {
                badge = document.getElementById('badge-comments-visor');
            } else if (role === 'revisor') {
                badge = document.getElementById('badge-comments-revisor');
            } else {
                badge = document.getElementById('badge-comments');
            }
            
            if (badge) {
                badge.style.display = 'none';
                badge.textContent = '0';
            }
            
            // NO actualizamos el timestamp al abrir el dropdown
            // Los mensajes seguirán siendo "nuevos" (gris) mientras el panel esté abierto
            
            loadCommentsDropdown();
        } else {
            // Al cerrar el dropdown, actualizar el timestamp al momento actual
            try {
                localStorage.setItem('lastSeenCommentTimestamp', new Date().toISOString());
                console.log('Panel cerrado: timestamp actualizado a la hora actual');
            } catch (e) {
                console.warn('No se puede guardar en localStorage:', e);
            }
            
            // Recargar el dropdown para que los puntos cambien a azul
            loadCommentsDropdown();
        }
    } else {
        console.log('No se encontró el dropdown');
    }
}

function createMessagesDropdown() {
    console.log('createMessagesDropdown iniciada');
    
    // Determinar el botón según el rol del usuario
    let btnMessages;
    if (currentUser && currentUser.role === 'visor') {
        btnMessages = document.getElementById('btn-messages-visor');
    } else if (currentUser && currentUser.role === 'revisor') {
        btnMessages = document.getElementById('btn-messages-revisor');
    } else {
        btnMessages = document.getElementById('btn-messages-admin');
    }
    
    if (!btnMessages) {
        console.log('No se encontró el botón de mensajes para el rol:', currentUser ? currentUser.role : 'desconocido');
        return;
    }

    const btnContainer = btnMessages.parentElement;
    if (!btnContainer) {
        console.log('No se encontró el contenedor del botón');
        return;
    }

    console.log('Contenedor encontrado:', btnContainer);

    const dropdown = document.createElement('div');
    dropdown.id = 'messages-dropdown';
    dropdown.className = 'comments-dropdown';
    dropdown.innerHTML = '<div class="comments-dropdown-header">Cargando...</div>';

    // No necesitamos position: relative en el contenedor del botón
    // ya que el dropdown es fixed
    document.body.appendChild(dropdown);

    console.log('Dropdown creado y agregado al DOM');

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        const btnMessagesAdmin = document.getElementById('btn-messages-admin');
        const btnMessagesVisor = document.getElementById('btn-messages-visor');
        const btnMessages = btnMessagesAdmin || btnMessagesVisor;
        
        if (btnMessages && !btnMessages.contains(e.target) && !dropdown.contains(e.target)) {
            commentsDropdownOpen = false;
            dropdown.classList.remove('open');
        }
    });
}

async function loadCommentsCount() {
    try {
        // Calcular fecha límite (hace 2 días)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - RETENTION_DAYS);
        twoDaysAgo.setHours(0, 0, 0, 0);

        const { data: comentarios, error } = await db()
            .from('comentarios')
            .select('*, fichas(folio), usuarios(username, role)')
            .gte('created_at', twoDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        const badge = document.getElementById('badge-comments');
        let lastSeenTimestamp = null;
        try {
            lastSeenTimestamp = localStorage.getItem('lastSeenCommentTimestamp');
        } catch (e) {
            console.warn('No se puede acceder a localStorage:', e);
        }
        
        // Filtrar comentarios visibles según rol (similar a loadCommentsDropdown)
        const currentRole = currentUser ? currentUser.role : null;
        let allowedRoles = [];
        if (currentRole === 'admin') allowedRoles = ['admin', 'revisor', 'visor']; // Admin ve a todos
        else if (currentRole === 'revisor') allowedRoles = ['admin', 'visor'];
        else if (currentRole === 'visor') allowedRoles = ['admin', 'revisor'];
        
        // Filtrar comentarios y contar solo los "nuevos"
        let unseenCount = 0;
        let visibleComments = [];
        
        if (comentarios && comentarios.length > 0) {
            visibleComments = comentarios.filter(comment => {
                // Verificar rol del autor
                if (comment.usuarios && comment.usuarios.role) {
                    return allowedRoles.includes(comment.usuarios.role);
                }
                return false;
            });
            
            // Contar comentarios nuevos (posteriores al último visto), excluyendo los propios
            visibleComments.forEach(comment => {
                // Excluir comentarios del usuario actual
                if (currentUser && comment.usuario_id === currentUser.id) {
                    return;
                }
                if (!lastSeenTimestamp || new Date(comment.created_at) > new Date(lastSeenTimestamp)) {
                    unseenCount++;
                }
            });
            
            // Debug
            console.log('Total comentarios:', comentarios.length);
            console.log('Comentarios visibles:', visibleComments.length);
            console.log('Last seen timestamp:', lastSeenTimestamp);
            console.log('Unseen count:', unseenCount);
            // Log de los primeros 3 comentarios visibles para depuración
            visibleComments.slice(0, 3).forEach((c, i) => {
                console.log(`Comentario visible ${i}: fecha=${c.created_at}, usuario=${c.usuarios?.username}`);
            });
        }

        // Mostrar burbuja solo si hay comentarios nuevos
        if (badge && unseenCount > 0) {
            badge.textContent = unseenCount;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }

        // No cargamos el dropdown aquí. El dropdown solo se carga cuando se abre o cuando llega un comentario nuevo.

    } catch (err) {
        console.error('Error loading comments:', err);
    }
}

async function loadCommentsCountVisor() {
    try {
        // Calcular fecha límite (hace 2 días)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - RETENTION_DAYS);
        twoDaysAgo.setHours(0, 0, 0, 0);

        const { data: comentarios, error } = await db()
            .from('comentarios')
            .select('*, fichas(folio), usuarios(username, role)')
            .gte('created_at', twoDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        const badge = document.getElementById('badge-comments-visor');
        let lastSeenTimestamp = null;
        try {
            lastSeenTimestamp = localStorage.getItem('lastSeenCommentTimestamp');
        } catch (e) {
            console.warn('No se puede acceder a localStorage:', e);
        }
        
        // Filtrar comentarios visibles según rol (similar a loadCommentsDropdown)
        // Para visor: ve Admin y Revisor
        const allowedRoles = ['admin', 'revisor'];
        
        // Filtrar comentarios y contar solo los "nuevos"
        let unseenCount = 0;
        let visibleComments = [];
        
        if (comentarios && comentarios.length > 0) {
            visibleComments = comentarios.filter(comment => {
                // Verificar rol del autor
                if (comment.usuarios && comment.usuarios.role) {
                    return allowedRoles.includes(comment.usuarios.role);
                }
                return false;
            });
            
            // Contar comentarios nuevos (posteriores al último visto), excluyendo los propios
            visibleComments.forEach(comment => {
                // Excluir comentarios del usuario actual
                if (currentUser && comment.usuario_id === currentUser.id) {
                    return;
                }
                if (!lastSeenTimestamp || new Date(comment.created_at) > new Date(lastSeenTimestamp)) {
                    unseenCount++;
                }
            });
        }

        // Mostrar burbuja solo si hay comentarios nuevos
        if (badge && unseenCount > 0) {
            badge.textContent = unseenCount;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }

        // No cargamos el dropdown aquí. El dropdown solo se carga cuando se abre o cuando llega un comentario nuevo.

    } catch (err) {
        console.error('Error loading comments for visor:', err);
    }
}

async function loadCommentsCountRevisor() {
    try {
        // Calcular fecha límite (hace 2 días)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - RETENTION_DAYS);
        twoDaysAgo.setHours(0, 0, 0, 0);

        const { data: comentarios, error } = await db()
            .from('comentarios')
            .select('*, fichas(folio), usuarios(nombre, role)')
            .gte('created_at', twoDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        const badge = document.getElementById('badge-comments-revisor');
        let lastSeenTimestamp = null;
        try {
            lastSeenTimestamp = localStorage.getItem('lastSeenCommentTimestamp');
        } catch (e) {
            console.warn('No se puede acceder a localStorage:', e);
        }
        
        // Filtrar comentarios visibles según rol (similar a loadCommentsDropdown)
        // Para revisor: ve Admin y Visor
        const allowedRoles = ['admin', 'visor'];
        
        // Filtrar comentarios y contar solo los "nuevos"
        let unseenCount = 0;
        let visibleComments = [];
        
        if (comentarios && comentarios.length > 0) {
            visibleComments = comentarios.filter(comment => {
                // Verificar rol del autor
                if (comment.usuarios && comment.usuarios.role) {
                    return allowedRoles.includes(comment.usuarios.role);
                }
                return false;
            });
            
            // Contar comentarios nuevos (posteriores al último visto), excluyendo los propios
            visibleComments.forEach(comment => {
                // Excluir comentarios del usuario actual
                if (currentUser && comment.usuario_id === currentUser.id) {
                    return;
                }
                if (!lastSeenTimestamp || new Date(comment.created_at) > new Date(lastSeenTimestamp)) {
                    unseenCount++;
                }
            });
        }

        // Mostrar burbuja solo si hay comentarios nuevos
        if (badge && unseenCount > 0) {
            badge.textContent = unseenCount;
            badge.style.display = 'flex';
        } else if (badge) {
            badge.style.display = 'none';
        }

        // No cargamos el dropdown aquí. El dropdown solo se carga cuando se abre o cuando llega un comentario nuevo.

    } catch (err) {
        console.error('Error loading comments for revisor:', err);
    }
}

async function loadCommentsDropdown(comentarios = null) {
    console.log('loadCommentsDropdown iniciada');
    let dropdown = document.getElementById('messages-dropdown');
    if (!dropdown) {
        console.log('No se encontró dropdown, creando...');
        createMessagesDropdown();
        dropdown = document.getElementById('messages-dropdown');
    }

    if (!dropdown) {
        console.log('No se pudo crear el dropdown');
        return;
    }

    // If comentarios not provided, load them with joins for folio and user name
    if (!comentarios) {
        console.log('Cargando comentarios desde la base de datos...');
        try {
            // Calcular fecha límite (hace 2 días)
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - RETENTION_DAYS);
            twoDaysAgo.setHours(0, 0, 0, 0);

            const { data, error } = await db()
                .from('comentarios')
                .select('*, fichas(folio), usuarios(username, role)') // Agregamos role aquí
                .gte('created_at', twoDaysAgo.toISOString())
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error en Supabase:', error);
                throw error;
            }
            comentarios = data;
            console.log('Comentarios cargados:', comentarios ? comentarios.length : 0);
        } catch (err) {
            console.error('Error loading comments dropdown:', err);
            return;
        }
    }

    let html = `
        <div class="comments-dropdown-header">
            <i class="fas fa-comments"></i> Comentarios Recientes
        </div>
    `;

    // Variable para contar los mostrados y arrays filtrados
    let totalMostrados = 0;
    let filteredComments = [];
    let filteredFallbackComments = [];
    let hasJoinedData = false;

    if (!comentarios || comentarios.length === 0) {
        html += `<div class="comment-item" style="text-align: center; color: #666;">No hay comentarios nuevos</div>`;
    } else {
        console.log('Generando HTML para', comentarios.length, 'comentarios');

        // Obtener el rol del usuario actual
        const currentRole = currentUser ? currentUser.role : null;

        // Definir qué roles son visibles para el rol actual
        // Admin: ve Admin, Revisor y Visor
        // Revisor: ve Admin y Visor
        // Visor: ve Admin y Revisor
        let allowedRoles = [];
        if (currentRole === 'admin') {
            allowedRoles = ['admin', 'revisor', 'visor'];
        } else if (currentRole === 'revisor') {
            allowedRoles = ['admin', 'visor'];
        } else if (currentRole === 'visor') {
            allowedRoles = ['admin', 'revisor'];
        } else {
            // Si no hay rol o es desconocido, no mostramos nada por seguridad
            allowedRoles = [];
        }

        // Filtrar comentarios basados en el rol del autor y excluir los del usuario actual
        filteredComments = comentarios.filter(comment => {
            // Excluir comentarios del usuario actual
            if (currentUser && comment.usuario_id === currentUser.id) {
                return false;
            }
            // Verificar si el comentario tiene datos de usuario unidos
            if (comment.usuarios && comment.usuarios.role) {
                return allowedRoles.includes(comment.usuarios.role);
            }
            // Si no tiene datos unidos (fallback), no lo mostramos en el dropdown
            // (podríamos hacer una segunda consulta para obtener el rol, pero por simplicidad lo omitimos aquí)
            return false;
        });

        // Check if comentarios have joined data (fichas, usuarios)
        // Solo si hay comentarios filtrados
        if (filteredComments.length > 0) {
            hasJoinedData = filteredComments[0].fichas && filteredComments[0].usuarios;
        }

        if (hasJoinedData) {
            // Use joined data
            totalMostrados = filteredComments.length; // Contamos todos los filtrados, no solo los primeros 10
            let lastSeenTimestamp = null;
            try {
                lastSeenTimestamp = localStorage.getItem('lastSeenCommentTimestamp');
            } catch (e) {
                console.warn('No se puede acceder a localStorage:', e);
            }
            
            filteredComments.slice(0, 10).forEach(comment => {
                const tipoClass = `comment-type-${comment.tipo || 'revision'}`;
                const tipoLabel = comment.tipo === 'aprobacion' ? 'Aprobación' :
                    comment.tipo === 'revision' ? 'Revisión' : 'Datos Incorrectos';
                const fecha = new Date(comment.created_at).toLocaleDateString('es-ES');
                const hora = new Date(comment.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                const usuarioNombre = comment.usuarios?.username || 'Usuario desconocido';
                const folio = comment.fichas?.folio || 'N/A';
                
                // Determinar si es nuevo (no leído)
                const isNew = !lastSeenTimestamp || new Date(comment.created_at) > new Date(lastSeenTimestamp);
                
                // Status visual: Gris si es nuevo, Azul si ya se vio
                const statusColor = isNew ? '#999' : '#007bff'; // Gris para nuevo, Azul para visto
                const statusIndicator = `<span style="display: inline-block; width: 10px; height: 10px; background-color: ${statusColor}; border-radius: 50%; margin-left: 8px;"></span>`;
                
                if (isNew) {
                    console.log(`Comentario nuevo detectado: fecha=${comment.created_at}, lastSeen=${lastSeenTimestamp}, usuario=${usuarioNombre}`);
                }

                html += `
                    <div class="comment-item ${isNew ? 'comment-new' : ''}" onclick="openFichaDetail('${comment.ficha_id || ''}')">
                        <div style="display: flex; align-items: center;">
                            <span class="comment-type ${tipoClass}">${tipoLabel}</span>
                            ${statusIndicator}
                        </div>
                        <div>${comment.texto || 'Sin texto'}</div>
                        <div class="comment-details">
                            <strong>Folio:</strong> ${folio} | 
                            <strong>Usuario:</strong> ${usuarioNombre} | 
                            <strong>Fecha:</strong> ${fecha} ${hora}
                        </div>
                    </div>
                `;
            });
        } else {
            hasJoinedData = false; // En el fallback no tenemos datos unidos
            // Fetch all fichas and usuarios for mapping (fallback)
            try {
                const { data: fichas, error: fichasError } = await db()
                    .from('fichas')
                    .select('id, folio');

                const { data: usuarios, error: usuariosError } = await db()
                    .from('usuarios')
                    .select('id, username, role');

                if (fichasError) console.error('Error fetching fichas:', fichasError);
                if (usuariosError) console.error('Error fetching usuarios:', usuariosError);

                // Create maps for quick lookup
                const fichaLookupMap = new Map(fichas?.map(f => [f.id, f.folio]) || []);
                const usuarioMap = new Map(usuarios?.map(u => [u.id, u.username]) || []);
                const usuarioRoleMap = new Map(usuarios?.map(u => [u.id, u.role]) || []);

                // Aplicar filtro de roles también en el fallback y excluir los del usuario actual
                filteredFallbackComments = comentarios.filter(comment => {
                    // Excluir comentarios del usuario actual
                    if (currentUser && comment.usuario_id === currentUser.id) {
                        return false;
                    }
                    const userRole = usuarioRoleMap.get(comment.usuario_id);
                    if (userRole && allowedRoles.includes(userRole)) {
                        return true;
                    }
                    return false;
                });

                totalMostrados = filteredFallbackComments.length;
                let lastSeenTimestamp = null;
                try {
                    lastSeenTimestamp = localStorage.getItem('lastSeenCommentTimestamp');
                } catch (e) {
                    console.warn('No se puede acceder a localStorage:', e);
                }
                
                filteredFallbackComments.slice(0, 10).forEach(comment => {
                    const tipoClass = `comment-type-${comment.tipo || 'revision'}`;
                    const tipoLabel = comment.tipo === 'aprobacion' ? 'Aprobación' :
                        comment.tipo === 'revision' ? 'Revisión' : 'Datos Incorrectos';
                    const fecha = new Date(comment.created_at).toLocaleDateString('es-ES');
                    const hora = new Date(comment.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    const usuarioNombre = usuarioMap.get(comment.usuario_id) || 'Usuario desconocido';
                    const folio = fichaLookupMap.get(comment.ficha_id) || 'N/A';
                    
                    // Determinar si es nuevo (no leído)
                    const isNew = !lastSeenTimestamp || new Date(comment.created_at) > new Date(lastSeenTimestamp);
                    
                    // Status visual: Gris si es nuevo, Azul si ya se vio
                    const statusColor = isNew ? '#999' : '#007bff'; // Gris para nuevo, Azul para visto
                    const statusIndicator = `<span style="display: inline-block; width: 10px; height: 10px; background-color: ${statusColor}; border-radius: 50%; margin-left: 8px;"></span>`;

                    html += `
                        <div class="comment-item ${isNew ? 'comment-new' : ''}" onclick="openFichaDetail('${comment.ficha_id || ''}')">
                            <div style="display: flex; align-items: center;">
                                <span class="comment-type ${tipoClass}">${tipoLabel}</span>
                                ${statusIndicator}
                            </div>
                            <div>${comment.texto || 'Sin texto'}</div>
                            <div class="comment-details">
                                <strong>Folio:</strong> ${folio} | 
                                <strong>Usuario:</strong> ${usuarioNombre} | 
                                <strong>Fecha:</strong> ${fecha} ${hora}
                            </div>
                        </div>
                    `;
                });
            } catch (err) {
                console.error('Error fetching data for comments:', err);
                // No podemos filtrar por rol sin datos de usuario, no mostramos comentarios por seguridad
                html += `<div class="comment-item" style="text-align: center; color: #666;">Error al cargar comentarios</div>`;
            }
        }
    }

    dropdown.innerHTML = html;
    console.log('Dropdown actualizado con', totalMostrados, 'comentarios (filtrados por rol)');

    // No actualizamos el timestamp aquí. Ya se actualizó en toggleMessagesDropdown al abrir el dropdown.
}

// ---- Load Existing PDFs ----
async function loadExistingPDFs(fichaId) {
    console.log('loadExistingPDFs called with fichaId:', fichaId);
    const existingPdfsSection = document.getElementById('existing-pdfs-section');
    const existingPdfsList = document.getElementById('existing-pdfs-list');
    
    if (!existingPdfsSection || !existingPdfsList) return;

    try {
        const [archivosResult, usuariosResult] = await Promise.all([
            db().from('archivos_ficha').select('*').eq('ficha_id', fichaId).order('created_at', { ascending: false }),
            db().from('usuarios').select('id, username')
        ]);

        const archivos = archivosResult.data;
        const error = archivosResult.error;
        const usuarios = usuariosResult.data || [];

        if (error) throw error;

        // Crear un mapa de usuarios para acceso rápido (usando username)
        const userMap = new Map(usuarios.map(u => [u.id, u.username]));
        console.log('Usuarios cargados para mapeo (edición):', userMap);

        if (archivos && archivos.length > 0) {
            existingPdfsSection.style.display = 'block';
            
            let pdfHTML = '<div class="existing-pdf-list">';
            archivos.forEach(arch => {
                const sizeKB = (arch.peso_optimizado / 1024).toFixed(1);
                const userName = arch.usuario_id ? (userMap.get(arch.usuario_id) || 'Usuario desconocido') : 'Usuario desconocido';
                const uploadDate = new Date(arch.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                pdfHTML += `
                    <div class="existing-pdf-item" id="pdf-item-${arch.id}">
                        <div class="pdf-info">
                            <i class="fas fa-file-pdf"></i>
                            <div class="pdf-details">
                                <span class="pdf-name">${arch.nombre_original}</span>
                                <span class="pdf-meta">${userName} • ${uploadDate} • ${sizeKB} KB</span>
                            </div>
                        </div>
                        <div class="pdf-actions">
                            <button class="btn btn-sm btn-secondary" onclick="downloadPDF('${arch.nombre_optimizado}')">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deletePDF('${arch.id}', '${arch.nombre_optimizado}', '${fichaId}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            pdfHTML += '</div>';
            
            existingPdfsList.innerHTML = pdfHTML;
        } else {
            existingPdfsSection.style.display = 'none';
        }
    } catch (err) {
        console.error('Error loading existing PDFs:', err);
        existingPdfsSection.style.display = 'none';
    }
}

// ---- Delete PDF ----
async function deletePDF(archivoId, fileName, fichaId) {
    const message = `¿Estás seguro de que deseas eliminar este archivo PDF?\n\nNOTA: Esta acción es permanente.`;

    const confirmed = await showDeleteNotification(message);

    if (!confirmed) {
        return;
    }

    try {
        // 1. Eliminar el archivo de Supabase Storage
        const { error: storageError } = await supabaseClient.storage
            .from('archivos_ficha')
            .remove([fileName]);

        if (storageError) throw storageError;

        // 2. Eliminar el registro de la tabla archivos_ficha
        const { error: dbError } = await db()
            .from('archivos_ficha')
            .delete()
            .eq('id', archivoId);

        if (dbError) throw dbError;

        showToast('Archivo eliminado correctamente', 'success');

        // 3. Actualizar la lista visualmente
        const pdfItem = document.getElementById(`pdf-item-${archivoId}`);
        if (pdfItem) {
            pdfItem.remove();
        }

        // 4. Si no quedan archivos, ocultar la sección
        const existingPdfsList = document.getElementById('existing-pdfs-list');
        if (existingPdfsList && existingPdfsList.children.length === 0) {
            const existingPdfsSection = document.getElementById('existing-pdfs-section');
            if (existingPdfsSection) existingPdfsSection.style.display = 'none';
        }

    } catch (err) {
        console.error('Error deleting PDF:', err);
        showToast('Error al eliminar el archivo', 'error');
    }
}

// ---- PDF Optimization and Upload ----
async function uploadAndOptimizePDFs(fichaId, files) {
    console.log('Optimizando y subiendo PDFs para ficha:', fichaId);

    for (let file of files) {
        try {
            // 1. Leer el archivo PDF
            const arrayBuffer = await file.arrayBuffer();

            // 2. Optimizar el PDF con pdf-lib
            const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

            // Comprimir imágenes (si las hay) y eliminar objetos innecesarios
            // pdf-lib no tiene compresión automática avanzada, pero podemos serializar de nuevo
            // Esto por sí solo reduce el tamaño al reorganizar la estructura
            const optimizedBytes = await pdfDoc.save();

            // 3. Crear Blob optimizado
            const optimizedBlob = new Blob([optimizedBytes], { type: 'application/pdf' });

            // 4. Subir a Supabase Storage
            const fileName = `${fichaId}_${Date.now()}_${file.name}`;
            const { data, error } = await supabaseClient.storage
                .from('archivos_ficha')
                .upload(fileName, optimizedBlob);

            if (error) {
                console.error('Error subiendo PDF:', error);
                continue;
            }

            // 5. Guardar metadatos en la tabla archivos_ficha
            const metadata = {
                ficha_id: fichaId,
                usuario_id: currentUser ? currentUser.id : null, // Guardar el ID del usuario actual
                nombre_original: file.name,
                nombre_optimizado: fileName,
                peso_original: file.size,
                peso_optimizado: optimizedBlob.size,
                mime_type: file.type
            };

            const { error: metaError } = await db().from('archivos_ficha').insert([metadata]);

            if (metaError) {
                console.error('Error guardando metadatos:', metaError);
                console.error('Metadata intentada:', metadata);
                // Intentar eliminar el archivo subido si falla el guardado de metadatos
                await supabaseClient.storage.from('archivos_ficha').remove([fileName]);
            } else {
                console.log(`PDF optimizado: ${file.size} -> ${optimizedBlob.size} bytes`);
            }

        } catch (err) {
            console.error('Error procesando archivo:', file.name, err);
        }
    }
}

// ---- Dynamic Island Logic ----
function showDynamicIsland(message, type = 'info') {
    const island = document.getElementById('dynamic-island');
    const textElement = island.querySelector('.island-text');
    
    if (!island || !textElement) return;

    // 1. Actualizar texto
    textElement.textContent = message;
    
    // 2. Hacer visible la isla (si no lo es ya)
    island.classList.add('visible');
    
    // 3. Pequeño delay para asegurar que la transición de aparición ocurra antes de expandir
    setTimeout(() => {
        island.classList.add('expanded');
    }, 50);
    
    // 4. Auto-ocultar después de 3 segundos
    setTimeout(() => {
        island.classList.remove('expanded');
        
        // Esperar a que termine la animación de colapso antes de ocultar completamente
        setTimeout(() => {
            island.classList.remove('visible');
            // Resetear texto
            textElement.textContent = 'Notificaciones';
        }, 400); // Tiempo de la transición CSS
    }, 3000);
}

// Hook para conectar showToast con Dynamic Island
const originalShowToast = showToast;
showToast = function(message, type) {
    // Llamar a la función original (toast visual)
    originalShowToast(message, type);
    
    // Mostrar en la Dynamic Island
    showDynamicIsland(message, type);
};