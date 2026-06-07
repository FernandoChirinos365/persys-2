const Utils = {
    generarId: () => Math.random().toString(36).substr(2, 9),
    generarIdCorto: () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    generarCodigoPedido: () => 'PED-' + Math.floor(100000 + Math.random() * 900000),
    fechaHoy: () => new Date().toISOString().split('T')[0],
    obtenerTallasPorTipo: (tipo) => {
        if (tipo === 'A') return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
        if (tipo === 'B') return ['26', '28', '30', '32', '34', '36'];
        if (tipo === 'C') return ['2', '4', '6', '8', '10', '12', '14', '16'];
        if (tipo === 'A + C') return ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2', '4', '6', '8', '10', '12', '14', '16'];
        if (tipo === 'B + C') return ['26', '28', '30', '32', '34', '36', '2', '4', '6', '8', '10', '12', '14', '16'];
        return ['UNICA'];
    }
};