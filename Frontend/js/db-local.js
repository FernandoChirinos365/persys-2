class BaseDeDatos {
    constructor() {
        this.storageKey = 'sistemaRopaDB_v3';
        this.data = this.cargarDatos();
    }

    cargarDatos() {
        const data = localStorage.getItem(this.storageKey);
        if (data) return JSON.parse(data);
        return {
            usuarios: [
                new Usuario(1, 'admin', '1', 'controller', 'Admin Principal'),
                new Usuario(2, 'vendedora1', '1', 'vendedora', 'Ana Ventas'),
                new Usuario(3, 'vendedora2', '1', 'vendedora', 'Bea Ventas'),
                new Usuario(4, 'almacen1', '1', 'almacen', 'Jefe Almacén')
            ],
            productos: [], productosFisicos: [], clientes: [],
            pedidos: [], viajes: [], historial: []
        };
    }

    guardar() { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); }
    getTabla(tabla) { return this.data[tabla] || []; }

    insertar(tabla, item) {
        this.data[tabla].push(item);
        this.guardar();
        return item;
    }

    actualizar(tabla, idField, idValue, nuevosDatos) {
        const index = this.data[tabla].findIndex(i => i[idField] == idValue);
        if (index !== -1) {
            this.data[tabla][index] = { ...this.data[tabla][index], ...nuevosDatos };
            this.guardar();
            return true;
        }
        return false;
    }

    eliminar(tabla, idField, idValue) {
        const index = this.data[tabla].findIndex(i => i[idField] == idValue);
        if (index !== -1) {
            this.data[tabla].splice(index, 1);
            this.guardar();
            return true;
        }
    }

    calcularStockVenta(imei, talla) {
        const fisicos = this.data.productosFisicos.filter(p =>
            p.imei === imei && p.talla === talla && p.estado === 'DISPONIBLE'
        ).length;

        let comprometidos = 0;
        this.data.pedidos.forEach(pedido => {
            if (pedido.estado === 'Efectivo') {
                pedido.productos.forEach(prod => {
                    if (prod.imei === imei && prod.talla === talla) {
                        comprometidos += parseInt(prod.cantidad);
                    }
                });
            }
        });

        return Math.max(0, fisicos - comprometidos);
    }
}

const db = new BaseDeDatos();