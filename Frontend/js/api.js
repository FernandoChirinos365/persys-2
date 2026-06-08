const SUPABASE_URL = 'https://heypnhwfyslhgrwtfwjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UrJKz2PBbaf8Hf5jLGaXBA_ZaKGcXxY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Api = {
    login: async (email, password) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });
    if (error) return { ok: false, mensaje: error.message };

    const { data: perfil } = await supabaseClient
        .from('perfiles')
        .select('*, roles(nombre, modulos)')
        .eq('id', data.user.id)
        .single();

    if (!perfil) return { ok: false, mensaje: 'Perfil no encontrado' };
    if (perfil.bloqueado) {
        await supabaseClient.auth.signOut();
        return { ok: false, mensaje: 'No tienes acceso al sistema. Comunícate con un administrador.' };
    }

    return { 
        ok: true, 
        usuario: { 
            ...data.user, 
            nombre: perfil.nombre,
            email: perfil.email,
            rol: perfil.roles?.nombre,
            modulos: perfil.roles?.modulos || []
        } 
    };
},

    logout: async () => {
        await supabaseClient.auth.signOut();
    },

    getUsuarioActual: async () => {
        const { data } = await supabaseClient.auth.getUser();
        return data.user;
    },

crearUsuario: async (email, password, nombre, rol) => {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });
    if (error) return { ok: false, mensaje: error.message };

    const { error: errorPerfil } = await supabaseClient
        .from('perfiles')
        .insert({ id: data.user.id, email: email, nombre: nombre, rol: rol });

    if (errorPerfil) return { ok: false, mensaje: errorPerfil.message };
    return { ok: true };
},

bloquearUsuario: async (userId, bloquear) => {
    const { error } = await supabaseClient
        .from('perfiles')
        .update({ bloqueado: bloquear })
        .eq('id', userId);
    if (error) return { ok: false, mensaje: error.message };
    return { ok: true };
}
};