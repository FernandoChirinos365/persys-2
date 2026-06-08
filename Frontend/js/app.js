// MÓDULO 1: MODELOS
class Usuario {
    constructor(id, username, password, rol, nombre) {
        this.id = id; this.username = username; this.password = password; this.rol = rol; this.nombre = nombre;
    }
}

class Producto {
    constructor(id, imei, nombre, imagen, tipoTalla, precioRef, estado = 'Activo') {
        this.id = id; this.imei = imei; this.nombre = nombre; this.imagen = imagen;
        this.tipoTalla = tipoTalla; this.precioRef = precioRef; this.estado = estado;
    }
}

class ProductoFisico {
    constructor(id, imei, talla, estado = 'DISPONIBLE') {
        this.id = id;
        this.imei = imei;
        this.talla = talla;
        this.estado = estado;
        this.idPedidoAsignado = null;
        this.idItemPedido = null;
    }
}

class Cliente {
    constructor(telefono, nombre, genero = '', direccion = '') {
        this.telefono = telefono; this.nombre = nombre; this.genero = genero; this.direccion = direccion;
    }
}

class Pedido {
    constructor(codigo, info, productos = []) {
        this.codigo = codigo;
        this.info = info;
        this.estado = 'Solicitado';
        this.productos = productos;
        this.fechaCreacion = new Date().toISOString();
    }
}

class Viaje {
    constructor(id, idPedido, tipo, fecha, estado = 'Pendiente') {
        this.id = id; this.idPedido = idPedido;
        this.tipo = tipo;
        this.fecha = fecha;
        this.estado = estado;
        this.costo = 0;
    }
}

class HistorialCambio {
    constructor(entidad, idEntidad, usuario, accion, detalles) {
        this.fecha = new Date().toLocaleString();
        this.entidad = entidad; this.idEntidad = idEntidad;
        this.usuario = usuario; this.accion = accion; this.detalles = detalles;
    }
}

// MÓDULO 2: CONTROLADOR
class SistemaController {
    constructor() { this.usuarioActual = null; }

async login() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    const resultado = await Api.login(user, pass);

    if (resultado.ok) {
        this.usuarioActual = resultado.usuario;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display').innerText = resultado.usuario.email;
        this.renderMenu();
    } else {
        alert('Credenciales incorrectas: ' + resultado.mensaje);
    }
}

async logout() {
    await Api.logout();
    this.usuarioActual = null;
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-pass').value = '';
}

    renderMenu() {
    const menu = document.getElementById('menu-tabs');
    menu.innerHTML = '';
    const modulos = this.usuarioActual.modulos || [];

    const todasLasTabs = [
        { id: 'productos', label: 'Productos' },
        { id: 'usuarios', label: 'Usuarios' },
        { id: 'historial', label: 'Historial' },
        { id: 'ventas', label: '+ Nuevo Pedido' },
        { id: 'clientes', label: 'Clientes' },
        { id: 'lista_pedidos', label: 'Pedidos' },
        { id: 'catalogo', label: 'Ver Stock' },
        { id: 'viajes', label: 'Viajes / Picking' },
        { id: 'almacen_stock', label: 'Ingreso Stock' }
    ];

    const tabs = todasLasTabs.filter(t => modulos.includes(t.id));

    tabs.forEach(tab => {
        const btn = document.createElement('div');
        btn.className = 'nav-tab';
        btn.innerText = tab.label;
        btn.onclick = () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            this.navegar(tab.id);
        };
        menu.appendChild(btn);
    });
    if (tabs.length > 0) menu.firstChild.click();
}

    navegar(vistaId) {
        const area = document.getElementById('content-area'); area.innerHTML = '';
        switch (vistaId) {
            case 'productos': Vistas.renderGestionProductos(area); break;
            case 'usuarios': Vistas.renderUsuarios(area); break;
            case 'historial': Vistas.renderHistorial(area); break;
            case 'ventas': Vistas.renderNuevoPedido(area); break;
            case 'clientes': Vistas.renderClientes(area); break;
            case 'lista_pedidos': Vistas.renderListaPedidos(area); break;
            case 'catalogo': Vistas.renderCatalogoVenta(area); break;
            case 'almacen_stock': Vistas.renderAlmacenStock(area); break;
            case 'viajes': Vistas.renderViajes(area); break;
            default: area.innerHTML = '<p>En construcción</p>';
        }
    }
}

const sistema = new SistemaController();