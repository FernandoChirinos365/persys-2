# Persys-2 - Sistema de Gestión

Este es un proyecto de desarrollo web full-stack que utiliza una arquitectura separada de Frontend y Backend para gestionar datos de manera eficiente.

## 📂 Estructura del Proyecto

El proyecto está organizado en dos carpetas principales para mantener la separación de responsabilidades:

### 🖥️ Frontend
Contiene toda la interfaz de usuario y la lógica que corre en el navegador.
* **index.html**: La estructura principal de la aplicación.
* **styles.css**: Estilos visuales de la interfaz.
* **js/**: Carpeta con la lógica dividida por módulos:
    * **app.js**: Orquestador principal del frontend.
    * **api.js**: Encargado de las peticiones al servidor (fetch/axios).
    * **vistas.js**: Manejo del DOM y renderizado de componentes.
    * **db-local.js**: Gestión de datos en `localStorage` (etapa inicial).
    * **utils.js**: Funciones de ayuda y validaciones genéricas.

### ⚙️ Backend
Contiene la lógica del servidor y la conexión con la base de datos.
* **server.js**: Punto de entrada del servidor Node.js/Express.
* **supabaseClient.js**: Configuración y cliente para la conexión con Supabase.
* **package.json**: Definición de dependencias y scripts del backend.

## 🛠️ Tecnologías Utilizadas
* **Frontend**: HTML5, CSS3, JavaScript Moderno (ES6+).
* **Backend**: Node.js, Express.
* **Base de Datos**: Supabase (PostgreSQL).
* **Control de Versiones**: Git & GitHub.

## 🚀 Próximos Pasos (WIP)
1.  Migrar la persistencia de `localStorage` a la base de datos real en Supabase.
2.  Implementar rutas protegidas y autenticación.
3.  Despliegue (Deploy) de la aplicación.