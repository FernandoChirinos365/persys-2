const Vistas = {

    carritoTemp: [],
    editCarritoTemp: [],

    renderNuevoPedido: (container) => {
        if (!Vistas.carritoTemp) Vistas.carritoTemp = [];
        container.innerHTML = `
            <div class="grid-2">
                <div class="card">
                    <h3 class="mb-2">1. Productos</h3>
                    <input type="text" id="bus-live" placeholder="Buscar producto..." oninput="Vistas.buscarLive()">
                    <div id="live-results" class="mb-4" style="max-height: 250px; overflow-y: auto;"></div>
                </div>
                <div class="card">
                    <h3 class="mb-2">2. Carrito</h3>
                    <div id="cart-list" class="mb-4" style="min-height:100px;">Vacío</div>
                    <div class="flex justify-between items-center border-t pt-2">
                        <h2 id="cart-total">S/ 0</h2>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="Vistas.limpiarCarrito()">Limpiar</button>
                            <button class="btn btn-primary" onclick="Vistas.pasoFinalPedido()">Continuar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        if (Vistas.carritoTemp.length > 0) Vistas.renderCart();
    },

    buscarLive: async () => {
    const q = document.getElementById('bus-live').value.toLowerCase();
    const div = document.getElementById('live-results');
    div.innerHTML = '';
    if (q.length === 0) return;

    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('estado', 'Activo');

    if (error || !data) return;

    const encontrados = data.filter(p =>
        p.imei.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
    );

    if (encontrados.length === 0) { div.innerHTML = '<p>Sin coincidencias</p>'; return; }

    for (const p of encontrados) {
        const tallas = Utils.obtenerTallasPorTipo(p.tipo_talla);
        let btns = '';
        for (const t of tallas) {
            const s = await Vistas.calcularStockVenta(p.imei, t);
            const dis = s === 0 ? 'disabled style="opacity:0.5"' : '';
            const color = s > 0 ? 'btn-success' : 'btn-secondary';
            btns += `<button class="btn btn-sm ${color} m-2" ${dis} onclick="Vistas.addCart('${p.imei}','${t}',${p.precio_ref},'${p.nombre}')">${t} (${s})</button>`;
        }
        div.innerHTML += `<div class="search-result-item"><b>${p.nombre}</b> (${p.imei})<div>${btns}</div></div>`;
    }
},


    addCart: (imei, talla, precio) => {
        const p = db.getTabla('productos').find(x => x.imei === imei);
        Vistas.carritoTemp.push({ id: Date.now(), imei, nombre: p.nombre, talla, cantidad: 1, precio, genero: 'Dama', entalle: '' });
        Vistas.renderCart();
    },

    renderCart: () => {
        const div = document.getElementById('cart-list'); div.innerHTML = '';
        let total = 0;
        Vistas.carritoTemp.forEach((it, idx) => {
            total += (it.cantidad * it.precio);
            div.innerHTML += `
                <div class="p-2 border rounded mb-2 bg-gray-50">
                    <div class="flex justify-between"><b>${it.nombre} (${it.talla})</b> <button class="text-red-500 font-bold" onclick="Vistas.delCart(${idx})">×</button></div>
                    <div class="flex gap-2 mt-1">
                        <input type="number" value="${it.cantidad}" style="width:50px" onchange="Vistas.updCart(${idx},'cantidad',this.value)">
                        <input type="number" value="${it.precio}" style="width:70px" onchange="Vistas.updCart(${idx},'precio',this.value)">
                        <select onchange="Vistas.updCart(${idx},'genero',this.value)"><option>Dama</option><option>Caballero</option></select>
                    </div>
                    <input type="text" placeholder="Entalle..." value="${it.entalle}" onchange="Vistas.updCart(${idx},'entalle',this.value)" style="font-size:0.8rem; margin:0;">
                </div>`;
        });
        document.getElementById('cart-total').innerText = `S/ ${total}`;
    },

    updCart: (idx, f, v) => {
        if (f === 'cantidad') {
            const s = db.calcularStockVenta(Vistas.carritoTemp[idx].imei, Vistas.carritoTemp[idx].talla);
            if (parseInt(v) > s) { alert(`Solo quedan ${s}`); Vistas.renderCart(); return; }
        }
        Vistas.carritoTemp[idx][f] = v; Vistas.renderCart();
    },
    delCart: (idx) => { Vistas.carritoTemp.splice(idx, 1); Vistas.renderCart(); },
    limpiarCarrito: () => { if (confirm('¿Borrar?')) { Vistas.carritoTemp = []; Vistas.renderCart(); } },

    pasoFinalPedido: () => {
        if (Vistas.carritoTemp.length === 0) return alert("Carrito vacío");

        const vendedoras = db.getTabla('usuarios').filter(u => u.rol === 'vendedora');
        const optionsVend = vendedoras.map(v => `<option value="${v.nombre}">${v.nombre}</option>`).join('');

        const html = `
            <h3>Completar Pedido</h3>
            <div class="grid-2">
                <div class="card">
                    <h4>Cliente</h4>
                    <div style="position:relative;">
                        <label>Teléfono (Busca auto.)</label>
                        <input type="text" id="info-tel" onkeyup="Vistas.buscarClienteInput()" autocomplete="off">
                        <div id="lista-clientes-sug" class="autocomplete-list hidden"></div>
                    </div>
                    <button id="btn-reg-cli" class="btn btn-sm btn-primary w-full hidden mb-2" onclick="Vistas.modalQuickCliente()">+ Registrar Cliente Nuevo</button>
                    <input type="text" id="info-nom" placeholder="Nombre Cliente" readonly>

                    <h4 class="mt-4">Entrega</h4>
                    <div class="grid-2">
                        <div><label>Fecha</label><input type="date" id="info-fecha" value="${Utils.fechaHoy()}"></div>
                        <div><label>Tipo Pedido</label>
                            <select id="info-tipo" onchange="Vistas.toggleEnvioUI()">
                                <option value="Envio">Envío</option><option value="Visita">Visita</option>
                            </select>
                        </div>
                    </div>

                    <div id="ui-envio">
                        <label>Método Entrega</label>
                        <select id="info-metodo"><option>A Domicilio</option><option>Agencia</option></select>
                        <label>Empresa</label>
                        <select id="info-empresa"><option>Olva</option><option>Shalom</option><option>Otros</option></select>
                        <label>Ciudad</label><input type="text" id="info-ciudad">
                    </div>

                    <label>Dirección</label><input type="text" id="info-dir">
                    <label>URL Maps</label><input type="text" id="info-maps">
                    <label>Costo Envío (S/)</label><input type="number" id="info-envio" value="0" onchange="Vistas.calcTotalFinal()">
                </div>

                <div class="card">
                    <h4>Detalles Venta</h4>
                    <label>Vendedora Principal</label>
                    <input type="text" value="${sistema.usuarioActual.nombre}" disabled style="background:#eee">

                    <label>Vendedora Contribuyó (Opcional)</label>
                    <select id="info-vend2"><option value="">-- Ninguna --</option>${optionsVend}</select>

                    <label>Canal Venta</label>
                    <select id="info-canal">
                        <option value="Whatsapp" selected>Whatsapp</option><option>Facebook</option>
                        <option>Instagram</option><option>Tiktok</option><option>Teléfono</option><option>Otro</option>
                    </select>

                    <h4 class="mt-4">Pago</h4>
                    <label>Método Pago</label>
                    <select id="info-pago">
                        <option>YAPE</option><option>PLIN</option><option>BCP</option><option>BBVA</option>
                        <option>INTERBANK</option><option>SCOTIABANK</option><option>Banco Nación</option>
                        <option>Efectivo</option><option>Tarjeta</option>
                    </select>

                    <div class="grid-2">
                        <div><label>Partes a Pagar</label><input type="number" id="info-partes" value="1" onchange="Vistas.togglePagos()"></div>
                        <div id="ui-primer-pago" class="hidden"><label>1er Pago</label><input type="number" id="info-monto1"></div>
                    </div>

                    <div class="mt-4 p-2 bg-gray-100 rounded text-right">
                        <h2 id="display-total-final">Total: S/ 0</h2>
                    </div>

                    <button class="btn btn-success w-full mt-4" onclick="Vistas.guardarPedidoFull()">GUARDAR PEDIDO</button>
                    <button class="btn btn-secondary w-full mt-2" onclick="sistema.navegar('ventas')">Volver</button>
                </div>
            </div>
        `;
        document.getElementById('content-area').innerHTML = html;
        Vistas.calcTotalFinal();
    },

    toggleEnvioUI: () => {
        const tipo = document.getElementById('info-tipo').value;
        const div = document.getElementById('ui-envio');
        if (tipo === 'Visita') {
            div.innerHTML = `<label>Lugar</label><select id="info-metodo"><option>A Domicilio</option><option>Local Peri</option></select>
                             <label>Empresa</label><input id="info-empresa" value="Motorizado" disabled>`;
            document.getElementById('info-ciudad').value = 'Lima';
            document.getElementById('info-ciudad').parentElement.classList.add('hidden');
        } else {
            div.innerHTML = `<label>Método Entrega</label><select id="info-metodo"><option>A Domicilio</option><option>Agencia</option></select>
                             <label>Empresa</label><select id="info-empresa"><option>Olva</option><option>Shalom</option><option>Otros</option></select>
                             <label>Ciudad</label><input type="text" id="info-ciudad">`;
        }
    },

    togglePagos: () => {
        const p = parseInt(document.getElementById('info-partes').value);
        if (p > 1) document.getElementById('ui-primer-pago').classList.remove('hidden');
        else document.getElementById('ui-primer-pago').classList.add('hidden');
    },

    calcTotalFinal: () => {
        const prod = Vistas.carritoTemp.reduce((a, b) => a + (b.cantidad * b.precio), 0);
        const env = parseFloat(document.getElementById('info-envio').value || 0);
        document.getElementById('display-total-final').innerText = `Total: S/ ${prod + env}`;
    },

    buscarClienteInput: async () => {
    const val = document.getElementById('info-tel').value;
    const list = document.getElementById('lista-clientes-sug');
    const btn = document.getElementById('btn-reg-cli');
    list.innerHTML = '';

    if (val.length < 3) { list.classList.add('hidden'); return; }

    const { data } = await supabaseClient
        .from('clientes')
        .select('*')
        .ilike('telefono', `%${val}%`);

    if (!data || data.length === 0) {
        list.classList.add('hidden');
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
        list.classList.remove('hidden');
        data.forEach(c => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerText = `${c.telefono} - ${c.nombre}`;
            item.onclick = () => {
                document.getElementById('info-tel').value = c.telefono;
                document.getElementById('info-nom').value = c.nombre;
                document.getElementById('info-dir').value = c.direccion || '';
                list.classList.add('hidden');
            };
            list.appendChild(item);
        });
    }
},

    modalQuickCliente: () => {
        const tel = document.getElementById('info-tel').value;
        const html = `<h3>Nuevo Cliente Rápido</h3>
            <input type="text" id="q-tel" value="${tel}">
            <input type="text" id="q-nom" placeholder="Nombre">
            <input type="text" id="q-dir" placeholder="Dirección">
            <button class="btn btn-success w-full" onclick="Vistas.saveQuickCliente()">Guardar</button>
            <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>`;
        Vistas.abrirModal(html);
    },

    saveQuickCliente: () => {
        const t = document.getElementById('q-tel').value;
        const n = document.getElementById('q-nom').value;
        const d = document.getElementById('q-dir').value;
        if (!t || !n) return alert("Falta info");
        db.insertar('clientes', new Cliente(t, n, 'F', d));
        document.getElementById('info-tel').value = t;
        document.getElementById('info-nom').value = n;
        document.getElementById('info-dir').value = d;
        document.getElementById('btn-reg-cli').classList.add('hidden');
        Vistas.cerrarModal();
    },

    guardarPedidoFull: async () => {
    const tel = document.getElementById('info-tel').value;
    const nom = document.getElementById('info-nom').value;
    if (!tel || !nom) return alert("Faltan datos del cliente");

    const codigo = Utils.generarCodigoPedido();
    const costo_total = Vistas.carritoTemp.reduce((a, b) => a + (b.cantidad * b.precio), 0)
        + parseFloat(document.getElementById('info-envio').value || 0);

    const info = {
        tipo: document.getElementById('info-tipo').value,
        metodoEnt: document.getElementById('info-metodo').value,
        empresa: document.getElementById('info-empresa').value || 'Motorizado',
        ciudad: document.getElementById('info-ciudad')?.value || 'Lima',
        maps: document.getElementById('info-maps').value,
        envioCosto: document.getElementById('info-envio').value,
        vend1: sistema.usuarioActual.nombre,
        vend2: document.getElementById('info-vend2').value,
        canal: document.getElementById('info-canal').value,
        pagoMetodo: document.getElementById('info-pago').value,
        partes: document.getElementById('info-partes').value,
        pago1: document.getElementById('info-monto1')?.value || 0
    };

    const { error: errorPedido } = await supabaseClient.from('pedidos').insert({
        codigo,
        cliente_tel: tel,
        estado: 'Solicitado',
        fecha_pedido: Utils.fechaHoy(),
        fecha_entrega: document.getElementById('info-fecha').value,
        direccion: document.getElementById('info-dir').value,
        costo_total,
        es_regalo: false,
        info
    });

    if (errorPedido) return alert('Error al crear pedido: ' + errorPedido.message);

    const detalles = Vistas.carritoTemp.map(it => ({
        codigo_pedido: codigo,
        imei: it.imei,
        nombre: it.nombre,
        talla: it.talla,
        cantidad: parseInt(it.cantidad),
        precio_unit: parseFloat(it.precio)
    }));

    const { error: errorDetalle } = await supabaseClient.from('detalle_pedidos').insert(detalles);
    if (errorDetalle) return alert('Error al guardar detalles: ' + errorDetalle.message);

    await supabaseClient.from('historial').insert({
        entidad: 'Pedido', id_entidad: codigo,
        usuario: sistema.usuarioActual.email,
        accion: 'Crear', detalles: 'Pedido completo'
    });

    alert("Pedido creado: " + codigo);
    Vistas.carritoTemp = [];
    sistema.navegar('lista_pedidos');
},

renderViajes: async (container) => {
    container.innerHTML = `<h2>Viajes y Despacho</h2>
        <div class="table-container"><table><thead><tr><th>Fecha</th><th>Pedido</th><th>Tipo</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="lista-viajes"><tr><td colspan="5" style="text-align:center">Cargando...</td></tr></tbody></table></div>`;

    const { data, error } = await supabaseClient
        .from('viajes')
        .select('*')
        .order('fecha', { ascending: false });

    const tbody = document.getElementById('lista-viajes');
    if (error || !data) { tbody.innerHTML = '<tr><td colspan="5">Error al cargar</td></tr>'; return; }

    tbody.innerHTML = '';
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Sin viajes</td></tr>'; return; }

    data.forEach(v => {
        let btnAccion = '';
        if (v.estado === 'Pendiente') btnAccion = `<button class="btn btn-sm btn-primary" onclick="Vistas.modalAlistarViaje(${v.id})">Alistar (Picking)</button>`;
        else if (v.estado === 'Alistado') btnAccion = `<span style="color:green;font-weight:bold">Listo para Salir</span>`;

        tbody.innerHTML += `<tr>
            <td>${v.fecha}</td>
            <td>${v.codigo_pedido}</td>
            <td>${v.tipo}</td>
            <td><span class="badge badge-${v.estado.toLowerCase()}">${v.estado}</span></td>
            <td>${btnAccion}</td>
        </tr>`;
    });
},

modalAlistarViaje: async (idViaje) => {
    const { data: viaje } = await supabaseClient.from('viajes').select('*').eq('id', idViaje).single();
    const { data: detalles } = await supabaseClient
        .from('detalle_pedidos')
        .select('*')
        .eq('codigo_pedido', viaje.codigo_pedido);

    let html = `<h3>Alistar Pedido: ${viaje.codigo_pedido}</h3><p class="mb-2 text-sm text-gray-500">Asigna productos físicos por cantidad.</p>`;
    let todoCompleto = true;

    for (const prod of detalles) {
        const { data: asignados } = await supabaseClient
            .from('productos_fisicos')
            .select('id')
            .eq('id_pedido_asignado', viaje.codigo_pedido)
            .eq('imei', prod.imei)
            .eq('talla', prod.talla);

        const cantidadNecesaria = parseInt(prod.cantidad);
        const cantidadAsignada = asignados?.length || 0;
        const completado = cantidadAsignada >= cantidadNecesaria;
        if (!completado) todoCompleto = false;

        const colorBorder = completado ? 'green' : '#ccc';
        const statusText = completado
            ? '<span style="color:green;font-weight:bold">COMPLETO</span>'
            : `<span style="color:red;font-weight:bold">${cantidadAsignada} / ${cantidadNecesaria}</span>`;

        const listaIds = asignados?.length
            ? `<div class="mt-2 text-xs text-gray-600">IDs: ${asignados.map(a => `<b>${a.id}</b>`).join(', ')}</div>`
            : '';

        const inputHtml = !completado ? `
            <div class="mt-2" style="position:relative;">
                <input type="text" placeholder="Escribir ID Físico..."
                    onkeyup="Vistas.buscarFisicoPicking(this,'${prod.imei}','${prod.talla}',${idViaje})"
                    class="mb-0">
                <div class="autocomplete-list hidden"></div>
            </div>` : '';

        html += `
            <div class="card mb-2" style="border-left:4px solid ${colorBorder};padding:1rem;">
                <div class="flex justify-between"><b>${prod.nombre} (${prod.talla})</b>${statusText}</div>
                <div class="text-sm text-gray-500">IMEI: ${prod.imei}</div>
                ${listaIds}${inputHtml}
            </div>`;
    }

    if (!todoCompleto) html += `<div class="p-2 bg-yellow-100 text-yellow-800 text-sm mt-4 rounded text-center">Falta asignar productos para finalizar.</div>`;
    html += `<button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cerrar</button>`;
    Vistas.abrirModal(html);
},

buscarFisicoPicking: async (input, imei, talla, idViaje) => {
    const val = input.value.toUpperCase();
    const list = input.nextElementSibling;
    list.innerHTML = '';
    if (val.length < 1) { list.classList.add('hidden'); return; }

    const { data } = await supabaseClient
        .from('productos_fisicos')
        .select('id')
        .eq('estado', 'DISPONIBLE')
        .eq('imei', imei)
        .eq('talla', talla)
        .ilike('id', `%${val}%`);

    if (!data || data.length === 0) { list.classList.add('hidden'); return; }

    list.classList.remove('hidden');
    data.forEach(pf => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerText = `ID: ${pf.id}`;
        item.onclick = () => Vistas.asignarFisico(pf.id, idViaje);
        list.appendChild(item);
    });
},

asignarFisico: async (idFisico, idViaje) => {
    const { data: viaje } = await supabaseClient.from('viajes').select('*').eq('id', idViaje).single();

    await supabaseClient.from('productos_fisicos')
        .update({ estado: 'ASIGNADO', id_pedido_asignado: viaje.codigo_pedido })
        .eq('id', idFisico);

    const { data: detalles } = await supabaseClient
        .from('detalle_pedidos')
        .select('*')
        .eq('codigo_pedido', viaje.codigo_pedido);

    let isTripComplete = true;
    for (const prod of detalles) {
        const { data: asignados } = await supabaseClient
            .from('productos_fisicos')
            .select('id')
            .eq('id_pedido_asignado', viaje.codigo_pedido)
            .eq('imei', prod.imei)
            .eq('talla', prod.talla);
        if ((asignados?.length || 0) < parseInt(prod.cantidad)) isTripComplete = false;
    }

    if (isTripComplete) {
        await supabaseClient.from('viajes').update({ estado: 'Alistado' }).eq('id', idViaje);
        alert("¡Picking completado! El viaje pasó a 'Alistado'.");

        const { data: todosViajes } = await supabaseClient
            .from('viajes')
            .select('estado')
            .eq('codigo_pedido', viaje.codigo_pedido)
            .neq('estado', 'Cancelado');

        const todosAlistados = todosViajes?.every(v => v.estado === 'Alistado' || v.estado === 'Realizado');
        if (todosAlistados) {
            await supabaseClient.from('pedidos').update({ estado: 'Alistado' }).eq('codigo', viaje.codigo_pedido);
            alert("¡Todos los viajes listos! El pedido está 'Alistado'.");
        }

        Vistas.cerrarModal();
        sistema.navegar('viajes');
    } else {
        Vistas.modalAlistarViaje(idViaje);
    }
},

    renderListaPedidos: async (container) => {
    container.innerHTML = `
        <h2>Pedidos</h2>
        <div class="table-container">
            <table>
                <thead><tr><th>Cód</th><th>Estado</th><th>Cliente</th><th>Entrega</th><th>Acciones</th></tr></thead>
                <tbody id="tb-ped"><tr><td colspan="5" style="text-align:center">Cargando...</td></tr></tbody>
            </table>
        </div>`;

    const { data, error } = await supabaseClient
        .from('pedidos')
        .select('*, clientes(nombre)')
        .order('fecha_pedido', { ascending: false });

    const tbody = document.getElementById('tb-ped');
    if (error || !data) { tbody.innerHTML = '<tr><td colspan="5">Error al cargar</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(p => {
        const badge = `badge-${p.estado.toLowerCase()}`;
        let botonesEdicion = '';
        if (p.estado === 'Solicitado' || p.estado === 'Efectivo') {
            botonesEdicion = `
                <button class="btn btn-sm btn-secondary" onclick="Vistas.modalEditarInfoPedido('${p.codigo}')">Info</button>
                <button class="btn btn-sm btn-warning" onclick="Vistas.modalEditarProductosPedido('${p.codigo}')">Prods</button>
            `;
        }
        tbody.innerHTML += `<tr>
            <td><b>${p.codigo}</b></td>
            <td><span class="badge ${badge}">${p.estado}</span></td>
            <td>${p.cliente_tel}<br><small>${p.clientes?.nombre || ''}</small></td>
            <td>${p.fecha_entrega || '-'}<br><small>${p.info?.tipo || ''}</small></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="Vistas.modalEstadoPedido('${p.codigo}')">Estado</button>
                ${botonesEdicion}
            </td>
        </tr>`;
    });
},


    modalEditarInfoPedido: (cod) => {
        const p = db.getTabla('pedidos').find(x => x.codigo === cod);
        const vendedoras = db.getTabla('usuarios').filter(u => u.rol === 'vendedora');
        const optionsVend = vendedoras.map(v => `<option value="${v.nombre}" ${p.info.vend2 === v.nombre ? 'selected' : ''}>${v.nombre}</option>`).join('');

        const html = `
            <h3>Editar Información: ${cod}</h3>
            <div class="grid-2">
                <div>
                    <label>Fecha</label><input type="date" id="ei-fecha" value="${p.info.fecha}">
                    <label>Teléfono</label><input type="text" id="ei-tel" value="${p.info.tel}">
                    <label>Nombre</label><input type="text" id="ei-nom" value="${p.info.nom}">
                    <label>Dirección</label><input type="text" id="ei-dir" value="${p.info.dir}">
                    <label>Ciudad</label><input type="text" id="ei-ciudad" value="${p.info.ciudad}">
                    <label>Empresa</label><select id="ei-empresa">
                        <option ${p.info.empresa == 'Olva' ? 'selected' : ''}>Olva</option>
                        <option ${p.info.empresa == 'Shalom' ? 'selected' : ''}>Shalom</option>
                        <option ${p.info.empresa == 'Motorizado' ? 'selected' : ''}>Motorizado</option>
                        <option ${p.info.empresa == 'Otros' ? 'selected' : ''}>Otros</option>
                    </select>
                </div>
                <div>
                    <label>Método Pago</label><select id="ei-pago">
                        <option ${p.info.pagoMetodo == 'YAPE' ? 'selected' : ''}>YAPE</option>
                        <option ${p.info.pagoMetodo == 'PLIN' ? 'selected' : ''}>PLIN</option>
                        <option ${p.info.pagoMetodo == 'BCP' ? 'selected' : ''}>BCP</option>
                        <option ${p.info.pagoMetodo == 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                        <option ${p.info.pagoMetodo == 'Tarjeta' ? 'selected' : ''}>Tarjeta</option>
                    </select>
                    <label>Vendedora Apoyo</label><select id="ei-vend2"><option value="">--</option>${optionsVend}</select>
                    <label>Costo Envío</label><input type="number" id="ei-envio" value="${p.info.envioCosto}">
                    <label>URL Maps</label><input type="text" id="ei-maps" value="${p.info.maps}">
                </div>
            </div>
            <button class="btn btn-success w-full mt-4" onclick="Vistas.guardarEdicionInfoPedido('${cod}')">Guardar Cambios</button>
            <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
        `;
        Vistas.abrirModal(html);
    },

    guardarEdicionInfoPedido: (cod) => {
        const pedido = db.getTabla('pedidos').find(x => x.codigo === cod);

        const nuevosDatos = {
            ...pedido.info,
            fecha: document.getElementById('ei-fecha').value,
            tel: document.getElementById('ei-tel').value,
            nom: document.getElementById('ei-nom').value,
            dir: document.getElementById('ei-dir').value,
            ciudad: document.getElementById('ei-ciudad').value,
            empresa: document.getElementById('ei-empresa').value,
            pagoMetodo: document.getElementById('ei-pago').value,
            vend2: document.getElementById('ei-vend2').value,
            envioCosto: document.getElementById('ei-envio').value,
            maps: document.getElementById('ei-maps').value
        };

        db.actualizar('pedidos', 'codigo', cod, { info: nuevosDatos });
        db.insertar('historial', new HistorialCambio('Pedido', cod, sistema.usuarioActual.username, 'Editar Info', 'Actualización datos cliente/entrega'));

        alert('Información actualizada');
        Vistas.cerrarModal();
        sistema.navegar('lista_pedidos');
    },

    modalEditarProductosPedido: (cod) => {
        const p = db.getTabla('pedidos').find(x => x.codigo === cod);
        Vistas.editCarritoTemp = JSON.parse(JSON.stringify(p.productos));

        const html = `
            <h3>Editar Productos: ${cod}</h3>
            <div class="grid-2">
                <div class="card">
                    <h4 class="mb-2">Agregar Producto</h4>
                    <input type="text" id="edit-bus-live" placeholder="Buscar..." oninput="Vistas.buscarEditLive()">
                    <div id="edit-live-results" class="mb-4" style="max-height: 200px; overflow-y: auto;"></div>
                </div>
                <div class="card">
                    <h4 class="mb-2">Productos en Pedido</h4>
                    <div id="edit-cart-list"></div>
                    <div class="border-t pt-2 mt-2 text-right">
                        <h3 id="edit-cart-total"></h3>
                    </div>
                </div>
            </div>
            <button class="btn btn-success w-full mt-4" onclick="Vistas.guardarEdicionProductosPedido('${cod}')">Guardar Cambios de Productos</button>
            <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
        `;
        Vistas.abrirModal(html);
        Vistas.renderEditCart();
    },

    buscarEditLive: () => {
        const q = document.getElementById('edit-bus-live').value.toLowerCase();
        const div = document.getElementById('edit-live-results'); div.innerHTML = '';
        if (q.length === 0) return;

        const encontrados = db.getTabla('productos').filter(p => p.estado === 'Activo' && (p.imei.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)));

        encontrados.forEach(p => {
            const tallas = Utils.obtenerTallasPorTipo(p.tipoTalla);
            let btns = '';
            tallas.forEach(t => {
                const s = db.calcularStockVenta(p.imei, t);
                const color = s > 0 ? 'btn-success' : 'btn-secondary';
                btns += `<button class="btn btn-sm ${color} m-1" onclick="Vistas.addEditCart('${p.imei}','${t}',${p.precioRef})">${t} (${s})</button>`;
            });
            div.innerHTML += `<div class="search-result-item p-2 text-sm"><b>${p.nombre}</b><div>${btns}</div></div>`;
        });
    },

    calcularStockVenta: async (imei, talla) => {
    const { data: fisicos } = await supabaseClient
        .from('productos_fisicos')
        .select('id')
        .eq('imei', imei)
        .eq('talla', talla)
        .eq('estado', 'DISPONIBLE');

    const { data: pedidos } = await supabaseClient
        .from('detalle_pedidos')
        .select('cantidad, pedidos(estado)')
        .eq('imei', imei)
        .eq('talla', talla);

    const disponibles = fisicos?.length || 0;
    let comprometidos = 0;
    pedidos?.forEach(d => {
        if (d.pedidos?.estado === 'Efectivo') comprometidos += parseInt(d.cantidad);
    });

    return Math.max(0, disponibles - comprometidos);
},

    addCart: (imei, talla, precio, nombre) => {
    Vistas.carritoTemp.push({ id: Date.now(), imei, nombre, talla, cantidad: 1, precio, genero: 'Dama', entalle: '' });
    Vistas.renderCart();
},

    renderEditCart: () => {
        const div = document.getElementById('edit-cart-list');
        if (!div) return;
        div.innerHTML = '';
        let total = 0;

        Vistas.editCarritoTemp.forEach((it, idx) => {
            total += (it.cantidad * it.precio);
            div.innerHTML += `
                <div class="p-2 border rounded mb-2 bg-gray-50 text-sm">
                    <div class="flex justify-between">
                        <b>${it.nombre} (${it.talla})</b>
                        <button class="text-red-500 font-bold" onclick="Vistas.delEditCart(${idx})">×</button>
                    </div>
                    <div class="flex gap-2 mt-1">
                        <input type="number" value="${it.cantidad}" style="width:50px" onchange="Vistas.updEditCart(${idx},'cantidad',this.value)">
                        <input type="number" value="${it.precio}" style="width:70px" onchange="Vistas.updEditCart(${idx},'precio',this.value)">
                    </div>
                </div>`;
        });
        document.getElementById('edit-cart-total').innerText = `Total Productos: S/ ${total}`;
    },

    updEditCart: (idx, f, v) => {
        Vistas.editCarritoTemp[idx][f] = v;
        Vistas.renderEditCart();
    },

    delEditCart: (idx) => {
        Vistas.editCarritoTemp.splice(idx, 1);
        Vistas.renderEditCart();
    },

    guardarEdicionProductosPedido: (cod) => {
        if (Vistas.editCarritoTemp.length === 0) return alert("El pedido no puede quedar vacío");

        db.actualizar('pedidos', 'codigo', cod, { productos: Vistas.editCarritoTemp });
        db.insertar('historial', new HistorialCambio('Pedido', cod, sistema.usuarioActual.username, 'Editar Productos', 'Modificación items del pedido'));

        alert('Productos actualizados');
        Vistas.cerrarModal();
        sistema.navegar('lista_pedidos');
    },

    modalEstadoPedido: async (cod) => {
    const { data: p } = await supabaseClient.from('pedidos').select('*').eq('codigo', cod).single();
    const html = `
        <h3>Cambiar Estado: ${cod}</h3>
        <p>Estado Actual: <b>${p.estado}</b></p>
        <div class="flex flex-col gap-2">
            ${p.estado === 'Solicitado' ? `<button class="btn btn-success" onclick="Vistas.setEstado('${cod}','Efectivo')">Marcar como EFECTIVO (Crear Viaje)</button>` : ''}
            ${p.estado === 'Alistado' ? `<button class="btn btn-primary" onclick="Vistas.setEstado('${cod}','Enviado')">Marcar como ENVIADO</button>` : ''}
            <button class="btn btn-danger" onclick="Vistas.setEstado('${cod}','Cancelado')">Cancelar Pedido</button>
        </div>
        <button class="btn btn-secondary w-full mt-4" onclick="Vistas.cerrarModal()">Cerrar</button>
    `;
    Vistas.abrirModal(html);
},

    setEstado: async (cod, nuevo) => {
    const { data: p } = await supabaseClient.from('pedidos').select('*').eq('codigo', cod).single();

    if (nuevo === 'Efectivo') {
        await supabaseClient.from('viajes').insert({
            codigo_pedido: cod,
            tipo: 'Entrega',
            motivo: '',
            fecha: p.fecha_entrega || Utils.fechaHoy(),
            estado: 'Pendiente',
            costo: 0
        });
        alert("Viaje de entrega creado automáticamente.");
    }

    await supabaseClient.from('pedidos').update({ estado: nuevo }).eq('codigo', cod);

    if (nuevo === 'Cancelado') {
        await supabaseClient.from('viajes')
            .update({ estado: 'Cancelado' })
            .eq('codigo_pedido', cod)
            .eq('tipo', 'Entrega');

        const { data: fisicos } = await supabaseClient
            .from('productos_fisicos')
            .select('id')
            .eq('id_pedido_asignado', cod);

        if (fisicos?.length) {
            for (const pf of fisicos) {
                await supabaseClient.from('productos_fisicos')
                    .update({ estado: 'DISPONIBLE', id_pedido_asignado: null })
                    .eq('id', pf.id);
            }
        }
    }

    Vistas.cerrarModal();
    sistema.navegar('lista_pedidos');
},

renderGestionProductos: async (container) => {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Gestión de Productos</h2>
            <button class="btn btn-primary" onclick="Vistas.modalCrearProducto()">+ Nuevo Producto</button>
        </div>
        <div class="table-container">
            <table>
                <thead><tr><th>IMEI</th><th>Nombre</th><th>Tallas</th><th>Precio Ref</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody id="body-prod-admin"><tr><td colspan="6" style="text-align:center">Cargando...</td></tr></tbody>
            </table>
        </div>`;

    const { data, error } = await supabaseClient.from('productos').select('*').neq('estado', 'Eliminado');
    const tbody = document.getElementById('body-prod-admin');
    if (error || !data) { tbody.innerHTML = '<tr><td colspan="6">Error al cargar</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.imei}</td>
            <td>${p.nombre}</td>
            <td>${p.tipo_talla}</td>
            <td>S/ ${p.precio_ref}</td>
            <td><span class="badge" style="background:${p.estado == 'Activo' ? '#dcfce7' : '#fee2e2'}">${p.estado}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="Vistas.modalEditarProducto('${p.imei}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="Vistas.eliminarProducto('${p.imei}')">X</button>
            </td>
        </tr>`;
    });
},

    modalCrearProducto: () => {
        const html = `
            <h3>Registrar Producto</h3>
            <form onsubmit="event.preventDefault(); Vistas.guardarProductoNuevo()">
                <input type="text" id="p-imei" placeholder="IMEI" required>
                <input type="text" id="p-nom" placeholder="Nombre" required>
                <select id="p-talla" required>
                    <option value="">-- Seleccionar Tipo Talla --</option>
                    <option value="A">Tipo A (XS-XXL)</option>
                    <option value="B">Tipo B (26-36)</option>
                    <option value="C">Tipo C (2-16)</option>
                    <option value="Sin Talla">Sin Talla</option>
                </select>
                <input type="number" id="p-precio" placeholder="Precio Ref" value="99">
                <button class="btn btn-success w-full mt-4">Guardar</button>
                <button type="button" class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
            </form>
        `;
        Vistas.abrirModal(html);
    },

 guardarProductoNuevo: async () => {
    const imei = document.getElementById('p-imei').value;
    const nombre = document.getElementById('p-nom').value;
    const tipo_talla = document.getElementById('p-talla').value;
    const precio_ref = document.getElementById('p-precio').value;

    if (!imei || !nombre || !tipo_talla) return alert("Completa todos los campos");

    const { error } = await supabaseClient.from('productos').insert({ imei, nombre, tipo_talla, precio_ref });
    if (error) return alert('Error: ' + error.message);

    await supabaseClient.from('historial').insert({
        entidad: 'Producto', id_entidad: imei,
        usuario: sistema.usuarioActual.email,
        accion: 'Crear', detalles: 'Nuevo producto'
    });

    Vistas.cerrarModal();
    sistema.navegar('productos');
},

    modalEditarProducto: (imei) => {
        const p = db.getTabla('productos').find(x => x.imei === imei);
        let opcionesTalla = `<option value="${p.tipoTalla}" selected>${p.tipoTalla} (Actual)</option>`;

        if (p.tipoTalla === 'A') opcionesTalla += `<option value="A + C">A + C (Agregar tallas C)</option>`;
        if (p.tipoTalla === 'B') opcionesTalla += `<option value="B + C">B + C (Agregar tallas C)</option>`;

        const html = `
            <h3>Editar: ${p.nombre}</h3>
            <form onsubmit="event.preventDefault(); Vistas.guardarEdicionProducto('${imei}')">
                <label>IMEI</label><input type="text" id="e-imei" value="${p.imei}">
                <label>Nombre</label><input type="text" id="e-nom" value="${p.nombre}">
                <label>Precio Ref</label><input type="number" id="e-precio" value="${p.precioRef}">
                <label>Talla</label><select id="e-talla">${opcionesTalla}</select>
                <label>Estado</label>
                <select id="e-est">
                    <option value="Activo" ${p.estado == 'Activo' ? 'selected' : ''}>Activo</option>
                    <option value="Inactivo" ${p.estado == 'Inactivo' ? 'selected' : ''}>Inactivo</option>
                </select>
                <button class="btn btn-primary w-full mt-4">Guardar</button>
                <button type="button" class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
            </form>
        `;
        Vistas.abrirModal(html);
    },

    guardarEdicionProducto: async (imeiOriginal) => {
    const nuevoImei = document.getElementById('e-imei').value;
    if (nuevoImei !== imeiOriginal) {
        if (!confirm(`¿Cambiar IMEI de ${imeiOriginal} a ${nuevoImei}?`)) return;
    }

    const { error } = await supabaseClient.from('productos').update({
        imei: nuevoImei,
        nombre: document.getElementById('e-nom').value,
        precio_ref: document.getElementById('e-precio').value,
        tipo_talla: document.getElementById('e-talla').value,
        estado: document.getElementById('e-est').value
    }).eq('imei', imeiOriginal);

    if (error) return alert('Error: ' + error.message);
    Vistas.cerrarModal();
    sistema.navegar('productos');
},

    eliminarProducto: async (imei) => {
    if (!confirm("¿Eliminar producto?")) return;
    const { error } = await supabaseClient.from('productos').update({ estado: 'Eliminado' }).eq('imei', imei);
    if (error) return alert('Error: ' + error.message);
    sistema.navegar('productos');
},

 renderUsuarios: async (container) => {
    container.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Usuarios</h2>
            <button class="btn btn-primary" onclick="Vistas.modalCrearUsuario()">+ Usuario</button>
        </div>
        <div class="table-container">
            <table>
                <thead><tr><th>Email</th><th>Nombre</th><th>Rol</th><th>Acción</th></tr></thead>
                <tbody id="tb-user"><tr><td colspan="4" style="text-align:center">Cargando...</td></tr></tbody>
            </table>
        </div>`;

    const { data, error } = await supabaseClient
        .from('perfiles')
        .select('*');

    const tbody = document.getElementById('tb-user');
    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="4">Error al cargar usuarios</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(u => {
        tbody.innerHTML += `<tr>
            <td>${u.email}</td>
            <td>${u.nombre}</td>
            <td>${u.rol === 'vendedora' ? 'Ventas' : u.rol === 'almacen' ? 'Almacén' : 'Controller'}</td>
            <td>
    <button class="btn btn-sm btn-secondary" onclick="Vistas.modalEditarUsuario('${u.id}')">Editar</button>
    ${u.id !== sistema.usuarioActual.id
        ? `<button class="btn btn-sm btn-danger" onclick="Vistas.eliminarUsuario('${u.id}')">X</button>`
        : ''
    }
</td>
        </tr>`;
    });
},

modalCrearUsuario: () => {
    Vistas.abrirModal(`
        <h3>Nuevo Usuario</h3>
        <label>Correo electrónico</label>
        <input id="u-email" type="email" placeholder="correo@ejemplo.com">
        <label>Contraseña</label>
        <input id="u-pass" type="password" placeholder="Mínimo 6 caracteres">
        <label>Repetir contraseña</label>
        <input id="u-pass2" type="password" placeholder="Repite la contraseña">
        <p id="u-pass-msg" style="font-size:0.8rem; color:red; margin-top:-0.5rem; display:none;">Las contraseñas no coinciden</p>
        <label>Nombre completo</label>
        <input id="u-name" placeholder="Ej: Ana García">
        <label>Rol</label>
        <select id="u-rol">
            <option value="vendedora">Vendedora</option>
            <option value="almacen">Almacén</option>
            <option value="controller">Controller</option>
        </select>
        <button id="btn-crear-user" class="btn btn-success w-full mt-4" onclick="Vistas.guardarUsuario()" disabled>Crear Usuario</button>
        <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
    `);

    const pass1 = document.getElementById('u-pass');
    const pass2 = document.getElementById('u-pass2');
    const msg = document.getElementById('u-pass-msg');
    const btn = document.getElementById('btn-crear-user');

    const validar = () => {
        if (pass1.value.length < 6) {
            msg.innerText = 'Mínimo 6 caracteres';
            msg.style.display = 'block';
            btn.disabled = true;
        } else if (pass2.value && pass1.value !== pass2.value) {
            msg.innerText = 'Las contraseñas no coinciden';
            msg.style.display = 'block';
            btn.disabled = true;
        } else if (pass1.value === pass2.value && pass2.value.length >= 6) {
            msg.style.display = 'none';
            btn.disabled = false;
        } else {
            msg.style.display = 'none';
            btn.disabled = true;
        }
    };

    pass1.addEventListener('input', validar);
    pass2.addEventListener('input', validar);
},

guardarUsuario: async () => {
    const email = document.getElementById('u-email').value;
    const pass = document.getElementById('u-pass').value;
    const nombre = document.getElementById('u-name').value;
    const rol = document.getElementById('u-rol').value;

    if (!email || !pass || !nombre) return alert("Todos los campos son obligatorios");
    if (pass.length < 6) return alert("La contraseña debe tener mínimo 6 caracteres");

    const btn = document.querySelector('#modal-body .btn-success');
    btn.innerText = 'Creando...';
    btn.disabled = true;

    const resultado = await Api.crearUsuario(email, pass, nombre, rol);

    if (resultado.ok) {
        alert('Usuario creado exitosamente');
        Vistas.cerrarModal();
        sistema.navegar('usuarios');
    } else {
        alert('Error: ' + resultado.mensaje);
        btn.innerText = 'Crear Usuario';
        btn.disabled = false;
    }
},

eliminarUsuario: async (id) => {
    if (!confirm("¿Borrar este usuario? Esta acción no se puede deshacer.")) return;

    const { error } = await supabaseClient
        .from('perfiles')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Error al eliminar: ' + error.message);
        return;
    }
    sistema.navegar('usuarios');
},

modalEditarUsuario: async (id) => {
    const { data: u, error } = await supabaseClient
        .from('perfiles')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !u) return alert('Error al cargar usuario');

    const roles = ['vendedora', 'almacen', 'controller'];
    const options = roles.map(r =>
        `<option value="${r}" ${u.rol === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`
    ).join('');

    const btnBloqueo = id === sistema.usuarioActual.id ? '' : u.bloqueado
    ? `<button class="btn btn-success w-full mt-2" onclick="Vistas.toggleBloqueo('${id}', false)">✓ Desbloquear Usuario</button>`
    : `<button class="btn btn-danger w-full mt-2" onclick="Vistas.toggleBloqueo('${id}', true)">✗ Bloquear Usuario</button>`;
    
    Vistas.abrirModal(`
        <h3>Editar Usuario</h3>
        <label>Nombre</label>
        <input id="e-u-name" value="${u.nombre}">
        <label>Rol</label>
        <select id="e-u-rol">${options}</select>
        <button class="btn btn-primary w-full mt-4" onclick="Vistas.guardarEdicionUsuario('${id}')">Guardar Cambios</button>
        ${btnBloqueo}
        <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
    `);
},

guardarEdicionUsuario: async (id) => {
    const nombre = document.getElementById('e-u-name').value;
    const rol = document.getElementById('e-u-rol').value;

    if (!nombre) return alert("El nombre es obligatorio");

    const { error } = await supabaseClient
        .from('perfiles')
        .update({ nombre: nombre, rol: rol })
        .eq('id', id);

    if (error) return alert('Error al guardar: ' + error.message);

    alert('Usuario actualizado');
    Vistas.cerrarModal();
    sistema.navegar('usuarios');
},

toggleBloqueo: async (id, bloquear) => {
    const accion = bloquear ? 'bloquear' : 'desbloquear';
    if (!confirm(`¿Seguro que quieres ${accion} este usuario?`)) return;

    const resultado = await Api.bloquearUsuario(id, bloquear);
    if (resultado.ok) {
        alert(`Usuario ${bloquear ? 'bloqueado' : 'desbloqueado'} correctamente`);
        Vistas.cerrarModal();
        sistema.navegar('usuarios');
    } else {
        alert('Error: ' + resultado.mensaje);
    }
},  

    renderHistorial: (c) => {
        c.innerHTML = `<h2>Historial</h2><div class="table-container"><table><thead><tr><th>Fecha</th><th>Entidad</th><th>Detalle</th><th>User</th></tr></thead><tbody id="tb-hist"></tbody></table></div>`;
        db.getTabla('historial').reverse().slice(0, 50).forEach(h => {
            document.getElementById('tb-hist').innerHTML += `<tr><td>${h.fecha}</td><td>${h.entidad} (${h.accion})</td><td>${h.detalles}</td><td>${h.usuario}</td></tr>`;
        });
    },

renderClientes: async (c) => {
    c.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Clientes</h2>
            <button class="btn btn-primary" onclick="Vistas.modalCrearClienteFull()">+ Cliente</button>
        </div>
        <div class="table-container">
            <table>
                <thead><tr><th>Tel</th><th>Nombre</th><th>DNI</th><th>Dirección</th><th>Acción</th></tr></thead>
                <tbody id="tb-cli"><tr><td colspan="5" style="text-align:center">Cargando...</td></tr></tbody>
            </table>
        </div>`;

    const { data, error } = await supabaseClient.from('clientes').select('*');
    const tbody = document.getElementById('tb-cli');
    if (error || !data) { tbody.innerHTML = '<tr><td colspan="5">Error al cargar</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(cli => {
        tbody.innerHTML += `<tr>
            <td>${cli.telefono}</td>
            <td>${cli.nombre}</td>
            <td>${cli.dni || '-'}</td>
            <td>${cli.direccion || '-'}</td>
            <td><button class="btn btn-sm btn-secondary" onclick="Vistas.modalEditarCliente('${cli.telefono}')">Editar</button></td>
        </tr>`;
    });
},

modalCrearClienteFull: () => {
    Vistas.abrirModal(`
        <h3>Nuevo Cliente</h3>
        <label>Teléfono</label>
        <input id="new-cli-tel" placeholder="Ej: 987654321">
        <label>Nombre</label>
        <input id="new-cli-nom" placeholder="Nombre completo">
        <label>DNI</label>
        <input id="new-cli-dni" placeholder="Opcional">
        <label>Género</label>
        <select id="new-cli-gen">
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
        </select>
        <label>Dirección</label>
        <input id="new-cli-dir" placeholder="Opcional">
        <button class="btn btn-success w-full mt-4" onclick="Vistas.saveClienteFull()">Guardar</button>
        <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
    `);
},

saveClienteFull: async () => {
    const telefono = document.getElementById('new-cli-tel').value;
    const nombre = document.getElementById('new-cli-nom').value;
    const dni = document.getElementById('new-cli-dni').value;
    const genero = document.getElementById('new-cli-gen').value;
    const direccion = document.getElementById('new-cli-dir').value;

    if (!telefono || !nombre) return alert("Teléfono y nombre son obligatorios");

    const { error } = await supabaseClient.from('clientes').insert({ telefono, nombre, dni, genero, direccion });
    if (error) return alert('Error: ' + error.message);

    Vistas.cerrarModal();
    sistema.navegar('clientes');
},

modalEditarCliente: async (tel) => {
    const { data: c, error } = await supabaseClient.from('clientes').select('*').eq('telefono', tel).single();
    if (error || !c) return alert('Error al cargar cliente');

    Vistas.abrirModal(`
        <h3>Editar Cliente</h3>
        <label>Teléfono</label>
        <input value="${c.telefono}" disabled>
        <label>Nombre</label>
        <input id="ed-cli-nom" value="${c.nombre}">
        <label>DNI</label>
        <input id="ed-cli-dni" value="${c.dni || ''}">
        <label>Dirección</label>
        <input id="ed-cli-dir" value="${c.direccion || ''}">
        <button class="btn btn-primary w-full mt-4" onclick="Vistas.saveEdCliente('${tel}')">Guardar</button>
        <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cancelar</button>
    `);
},

saveEdCliente: async (tel) => {
    const { error } = await supabaseClient.from('clientes').update({
        nombre: document.getElementById('ed-cli-nom').value,
        dni: document.getElementById('ed-cli-dni').value,
        direccion: document.getElementById('ed-cli-dir').value
    }).eq('telefono', tel);

    if (error) return alert('Error: ' + error.message);
    Vistas.cerrarModal();
    sistema.navegar('clientes');
},

    renderCatalogoVenta: (c) => {
        c.innerHTML = `
            <h2>Stock Global</h2>
            <div class="sub-tabs mt-4">
                <div class="sub-tab active" onclick="Vistas.switchTabCatalogo(this, 'ventas')">Vista Ventas</div>
                <div class="sub-tab" onclick="Vistas.switchTabCatalogo(this, 'almacen')">Vista Almacén</div>
            </div>
            <div id="cat-content"></div>
        `;
        Vistas.renderCatalogoVentasContent();
    },

    switchTabCatalogo: (tab, view) => {
        document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (view === 'ventas') Vistas.renderCatalogoVentasContent();
        else Vistas.renderCatalogoAlmacenContent();
    },

    renderCatalogoVentasContent: () => {
        const div = document.getElementById('cat-content');
        div.innerHTML = '';
        db.getTabla('productos').forEach(p => {
            if (p.estado !== 'Activo') return;
            let badges = '';
            Utils.obtenerTallasPorTipo(p.tipoTalla).forEach(t => {
                const s = db.calcularStockVenta(p.imei, t);
                if (s > 0) badges += `<span class="badge badge-efectivo m-2">${t}: ${s}</span>`;
            });
            div.innerHTML += `<div class="card mb-2 flex justify-between"><div><b>${p.nombre}</b><br><small>${p.imei}</small></div><div>${badges || '<span class="text-red-500 text-sm">Sin Stock</span>'}</div></div>`;
        });
    },

    renderCatalogoAlmacenContent: () => {
        const div = document.getElementById('cat-content');
        div.innerHTML = '<p class="text-sm text-gray-500 mb-2">Productos físicos en almacén (No asignados).</p>';
        const disponibles = db.getTabla('productosFisicos').filter(pf => pf.estado === 'DISPONIBLE');

        if (disponibles.length === 0) {
            div.innerHTML += '<div class="p-4 text-center">Almacén Vacío</div>';
            return;
        }

        const html = `<div class="table-container"><table><thead><tr><th>ID Físico</th><th>IMEI</th><th>Talla</th></tr></thead><tbody>
            ${disponibles.map(pf => `<tr><td><b>${pf.id}</b></td><td>${pf.imei}</td><td>${pf.talla}</td></tr>`).join('')}
        </tbody></table></div>`;
        div.innerHTML += html;
    },

renderAlmacenStock: async (c) => {
    c.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Stock Físico</h2>
            <button class="btn btn-primary" onclick="Vistas.modalAddStock()">+ Ingreso</button>
        </div>
        <div class="table-container">
            <table>
                <thead><tr><th>ID (QR)</th><th>Producto</th><th>Talla</th><th>Estado</th></tr></thead>
                <tbody id="tb-fis"><tr><td colspan="4" style="text-align:center">Cargando...</td></tr></tbody>
            </table>
        </div>`;

    const { data, error } = await supabaseClient
        .from('productos_fisicos')
        .select('*')
        .order('id', { ascending: false })
        .limit(100);

    const tbody = document.getElementById('tb-fis');
    if (error || !data) { tbody.innerHTML = '<tr><td colspan="4">Error al cargar</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(pf => {
        tbody.innerHTML += `<tr>
            <td>${pf.id}</td>
            <td>${pf.imei}</td>
            <td>${pf.talla}</td>
            <td>${pf.estado}</td>
        </tr>`;
    });
},


    modalAddStock: () => {
        const html = `
            <h3>Ingreso Almacén</h3>
            <p class="text-sm mb-2">Busca el producto para registrar stock:</p>
            <input type="text" id="stock-search" placeholder="Escribe nombre o IMEI..." oninput="Vistas.buscarProdStock()">
            <div id="stock-results" class="mb-4" style="max-height:150px; overflow-y:auto; border:1px solid #eee; display:none;"></div>

            <div id="stock-form" class="hidden" style="border-top:1px solid #eee; padding-top:1rem;">
                <label class="text-sm bold">Producto Seleccionado:</label>
                <input type="text" id="s-imei" readonly style="background:#f3f4f6;">
                <label class="text-sm bold">Talla:</label>
                <select id="s-talla"></select>
                <label class="text-sm bold">Cantidad a Crear:</label>
                <input type="number" id="s-cant" placeholder="Ej: 10">
                <button class="btn btn-success w-full mt-2" onclick="Vistas.saveStock()">Generar Stock</button>
            </div>
            <button class="btn btn-secondary w-full mt-2" onclick="Vistas.cerrarModal()">Cerrar</button>
        `;
        Vistas.abrirModal(html);
    },

buscarProdStock: async () => {
    const q = document.getElementById('stock-search').value.toLowerCase();
    const res = document.getElementById('stock-results');
    res.innerHTML = '';
    res.style.display = 'block';

    if (q.length < 1) { res.style.display = 'none'; return; }

    const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('estado', 'Activo');

    if (error || !data) return;

    const encontrados = data.filter(p =>
        p.imei.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q)
    );

    if (encontrados.length === 0) {
        res.innerHTML = '<div class="p-2 text-red-500">No hay coincidencias</div>';
        return;
    }

    encontrados.forEach(p => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<b>${p.nombre}</b> (${p.imei})`;
        item.onclick = () => Vistas.selectProdStock(p);
        res.appendChild(item);
    });
},

    selectProdStock: (prod) => {
    document.getElementById('stock-results').style.display = 'none';
    document.getElementById('stock-search').value = prod.nombre;
    document.getElementById('stock-form').classList.remove('hidden');
    document.getElementById('s-imei').value = prod.imei;

    const select = document.getElementById('s-talla');
    select.innerHTML = '';
    Utils.obtenerTallasPorTipo(prod.tipo_talla).forEach(t => {
        select.innerHTML += `<option value="${t}">${t}</option>`;
    });
},

    saveStock: async () => {
    const imei = document.getElementById('s-imei').value;
    const cant = parseInt(document.getElementById('s-cant').value);
    const talla = document.getElementById('s-talla').value;

    if (!cant || cant <= 0) return alert("Cantidad inválida");

    const items = [];
    for (let i = 0; i < cant; i++) {
        items.push({ id: Utils.generarIdCorto(), imei, talla, estado: 'DISPONIBLE' });
    }

    const { error } = await supabaseClient.from('productos_fisicos').insert(items);
    if (error) return alert('Error: ' + error.message);

    await supabaseClient.from('historial').insert({
        entidad: 'Stock Físico', id_entidad: imei,
        usuario: sistema.usuarioActual.email,
        accion: 'Ingreso', detalles: `${cant} unidades talla ${talla}`
    });

    Vistas.cerrarModal();
    sistema.navegar('almacen_stock');
},

    abrirModal: (h) => {
        document.getElementById('modal-body').innerHTML = h;
        document.getElementById('modal-container').classList.remove('hidden');
    },
    cerrarModal: () => {
        document.getElementById('modal-container').classList.add('hidden');
    }
};