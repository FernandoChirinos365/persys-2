const SUPABASE_URL = 'https://heypnhwfyslhgrwtfwjo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_UrJKz2PBbaf8Hf5jLGaXBA_ZaKGcXxY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Api = {
    login: async (username, password) => {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: username,
            password: password
        });
        if (error) return { ok: false, mensaje: error.message };
        return { ok: true, usuario: data.user };
    },

    logout: async () => {
        await supabaseClient.auth.signOut();
    },

    getUsuarioActual: async () => {
        const { data } = await supabaseClient.auth.getUser();
        return data.user;
    }
};