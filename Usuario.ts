// =============================================================================
// CAPA DE DOMINIO
// =============================================================================

// clase Usuario representa la entidad principal del dominio 
class Usuario {
    public readonly id: string;           //ID de solo lectura,no se puede modificar
    public readonly fechaCreacion: Date;  //Fecha de creación de solo lectura

    constructor(                          //recibe nombre, email y opcionalmente un ID
        public nombre: string,            //Propiedad pública nombre
        public email: string,             //Propiedad pública email
        id?: string                       //ID opcional
    ) {
        this.id = id || this.generarId(); //Si no se proporciona ID, genera uno automáticamente
        this.fechaCreacion = new Date();  //Establece la fecha actual como fecha de creación
        this.validar();                   //Ejecuta validaciones de reglas de negocio
    }

    private generarId(): string {  //Método privado para generar IDs únicos
        return 'user_' + Math.random().toString(36).substr(2, 9);
        //Crea un ID usando 'user_' + caracteres aleatorios
    }

    private validar(): void {    //Método privado que valida las reglas de negocio
        if (!this.nombre || this.nombre.trim().length < 2) {
            throw new Error('El nombre debe tener al menos 2 caracteres');
            //Valida que el nombre tenga al menos 2 caracteres
        }
        
        if (!this.email || !this.esEmailValido(this.email)) { //Valida que el email tenga formato correcto
            throw new Error('El email debe tener un formato válido');
        }
    }

    //Método privado para validar formato de email
    private esEmailValido(email: string): boolean {  
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;//validar formato de email
        return emailRegex.test(email); //Retorna true si el email coincide con el patrón
    }

    // Método para actualizar información del usuario
    actualizarDatos(nuevoNombre?: string, nuevoEmail?: string): Usuario {
        //usa el nuevo nombre o mantiene el actual
        const nombre = nuevoNombre || this.nombre;
        //usa el nuevo email o mantiene el actual
        const email = nuevoEmail || this.email;
        //retorna nueva instancia con los datos
        return new Usuario(nombre, email, this.id);
    }

        // Método para comparar usuarios
    esIgual(otroUsuario: Usuario): boolean {
        //Compara por email (criterio de igualdad de negocio)
        return this.email === otroUsuario.email;
    }
}

// Excepciones del dominio
class UsuarioNoEncontradoError extends Error {
    constructor(criterio: string) {
        //Llama al constructor padre con mensaje personalizado
        super(`Usuario no encontrado: ${criterio}`);
        //Establece el nombre de la excepción
        this.name = 'UsuarioNoEncontradoError';
    }
}

class UsuarioDuplicadoError extends Error { //lanzar un error cuando se intenta  
// crar un usuario con un correo electrónico que ya está en uso
    constructor(email: string) {
        super(`Ya existe un usuario con el email: ${email}`);
        this.name = 'UsuarioDuplicadoError';
    }
}

// =============================================================================
// PUERTOS (INTERFACES) - Contratos entre capas
// =============================================================================

// Puerto para el repositorio de usuarios
interface RepositorioUsuario {
    guardar(usuario: Usuario): Promise<void>; //Método para guardar usuario
    obtenerPorId(id: string): Promise<Usuario | null>; //Buscar usuario por ID
    obtenerPorEmail(email: string): Promise<Usuario | null>; //Buscar usuario por email
    obtenerTodos(): Promise<Usuario[]>;  //Obtener todos los usuarios
    buscar(termino: string): Promise<Usuario[]>;//Buscar usuarios por término
    eliminar(id: string): Promise<boolean>; //Eliminar usuario (retorna true si se eliminó)
    existe(email: string): Promise<boolean>; //Verificar si existe un email
}

// Puerto para el logger
interface Logger {
    info(mensaje: string, datos?: any): void;  // Log informativo
    error(mensaje: string, error?: Error): void;  // Log de errores
    warn(mensaje: string, datos?: any): void;  //Log de advertencias
}

// Puerto para notificaciones
interface ServicioNotificacion {
    enviarBienvenida(usuario: Usuario): Promise<void>; //Enviar email de bienvenida
    notificarActualizacion(usuario: Usuario): Promise<void>; //Notificar actualización de usuario
}

// =============================================================================
// CAPA DE APLICACIÓN - Casos de uso y lógica de aplicación
// =============================================================================

// DTOs para crear usuario
interface CrearUsuarioDto {
    nombre: string; //Nombre requerido
    email: string;  //Nombre email
}
//DTO para actualizar usuario
interface ActualizarUsuarioDto {
    id: string;  //ID requerido
    nombre?: string;
    email?: string;
}

interface UsuarioRespuestaDto {
    id: string;
    nombre: string;
    email: string;
    fechaCreacion: Date;
}

// Clase principal de la capa de aplicación
class UsuarioService {
    constructor(    //Constructor con inyección de dependencias
        private repositorio: RepositorioUsuario,  //Repositorio inyectado
        private logger: Logger,                   //
        private notificaciones: ServicioNotificacion //
    ) {}

    // Crear usuario con validaciones y notificaciones
    async agregarUsuario(datos: CrearUsuarioDto): Promise<UsuarioRespuestaDto> {
        this.logger.info('Iniciando creación de usuario', { email: datos.email });

        // Verificar si el usuario ya existe
        const existeUsuario = await this.repositorio.existe(datos.email);
        if (existeUsuario) {
            this.logger.warn('Intento de crear usuario duplicado', { email: datos.email });
            throw new UsuarioDuplicadoError(datos.email);
        }

        // Crear usuario
        const usuario = new Usuario(datos.nombre, datos.email);
        
        // Guardar en repositorio
        await this.repositorio.guardar(usuario);
        
        // Enviar notificación de bienvenida
        try {
            await this.notificaciones.enviarBienvenida(usuario);
        } catch (error) {
            this.logger.error('Error enviando notificación de bienvenida', error);
            // No fallar el proceso por error en notificación
        }

        this.logger.info('Usuario creado exitosamente', { 
            id: usuario.id, 
            email: usuario.email 
        });

        return this.mapearADto(usuario);
    }

    // Obtener todos los usuarios
    async obtenerUsuarios(): Promise<UsuarioRespuestaDto[]> {
        this.logger.info('Obteniendo lista de usuarios');
        
        const usuarios = await this.repositorio.obtenerTodos();
        
        this.logger.info(`Se encontraron ${usuarios.length} usuarios`);
        
        return usuarios.map(usuario => this.mapearADto(usuario));
    }

    // Buscar usuario por ID
    async obtenerUsuarioPorId(id: string): Promise<UsuarioRespuestaDto> {
        // log de busqueda
        this.logger.info('Buscando usuario por ID', { id });
        
        //buscar repositorio
        const usuario = await this.repositorio.obtenerPorId(id);
        //Si no existe, lanzar excepción
        if (!usuario) {
            this.logger.warn('Usuario no encontrado por ID', { id });
            throw new UsuarioNoEncontradoError(`ID: ${id}`);
        }

        return this.mapearADto(usuario); //Convertir a DTO
    }


    // Actualizar usuario
    async actualizarUsuario(datos: ActualizarUsuarioDto): Promise<UsuarioRespuestaDto> {
        this.logger.info('Actualizando usuario', { id: datos.id });

        //Verificar que el usuario existe
        const usuarioExistente = await this.repositorio.obtenerPorId(datos.id);
        if (!usuarioExistente) {
            throw new UsuarioNoEncontradoError(`ID: ${datos.id}`);
        }

        // Verificar email duplicado si se está cambiando
        if (datos.email && datos.email !== usuarioExistente.email) {
            const existeEmail = await this.repositorio.existe(datos.email);
            if (existeEmail) {
                throw new UsuarioDuplicadoError(datos.email);
            }
        }

        // Actualizar usuario
        const usuarioActualizado = usuarioExistente.actualizarDatos(
            datos.nombre, 
            datos.email
        );

        await this.repositorio.guardar(usuarioActualizado);//Guardar cambios

        // Notificar actualización
        try {
            await this.notificaciones.notificarActualizacion(usuarioActualizado);
        } catch (error) {
            this.logger.error('Error enviando notificación de actualización', error);
        }

        this.logger.info('Usuario actualizado exitosamente', { id: datos.id });

        return this.mapearADto(usuarioActualizado);
    }

    // Eliminar usuario
    async eliminarUsuario(id: string): Promise<boolean> {
        this.logger.info('Eliminando usuario', { id });

        const eliminado = await this.repositorio.eliminar(id);//Intentar eliminar del repositorio
        
        if (!eliminado) {//Si no se pudo eliminar, lanzar excepción
            this.logger.warn('No se pudo eliminar el usuario', { id });
            throw new UsuarioNoEncontradoError(`ID: ${id}`);
        }

        this.logger.info('Usuario eliminado exitosamente', { id });
        return true;
    }

    // Método privado para convertir entidad a DTO
    private mapearADto(usuario: Usuario): UsuarioRespuestaDto {
        return {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            fechaCreacion: usuario.fechaCreacion
        };
    }
}

// =============================================================================
// CAPA DE INFRAESTRUCTURA - Implementaciones concretas
// =============================================================================

// Implementación del repositorio en memoria
class RepositorioUsuarioEnMemoria implements RepositorioUsuario {
    private usuarios: Map<string, Usuario> = new Map();//Map privado para almacenar usuarios

    async guardar(usuario: Usuario): Promise<void> {//Guarda o actualiza usuario en el Map
        this.usuarios.set(usuario.id, usuario);
    }
//Implementa buscar por ID
    async obtenerPorId(id: string): Promise<Usuario | null> {//Implementa guardar usuario
        return this.usuarios.get(id) || null;//Busca en Map y retorna null si no existe
    }
//Implementa buscar por email
    async obtenerPorEmail(email: string): Promise<Usuario | null> {
        for (const usuario of this.usuarios.values()) {
            if (usuario.email === email) {
                return usuario;
            }
        }
        return null;
    }
//Implementa obtener todos
    async obtenerTodos(): Promise<Usuario[]> {//Convierte valores del Map a array
        return Array.from(this.usuarios.values());
    }
//Implementa búsqueda por término
    async buscar(termino: string): Promise<Usuario[]> {
        const terminoLower = termino.toLowerCase();
        const usuarios = Array.from(this.usuarios.values());
        
        return usuarios.filter(usuario => 
            usuario.nombre.toLowerCase().includes(terminoLower) ||
            usuario.email.toLowerCase().includes(terminoLower)
        );
    }

    async eliminar(id: string): Promise<boolean> {
        return this.usuarios.delete(id);
    }

    async existe(email: string): Promise<boolean> {
        const usuario = await this.obtenerPorEmail(email);
        return usuario !== null;
    }
}

// Implementación del logger para consola
class LoggerConsola implements Logger {
    info(mensaje: string, datos?: any): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [INFO] ${mensaje}`, 
            datos ? JSON.stringify(datos, null, 2) : '');
    }

    error(mensaje: string, error?: Error): void {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [ERROR] ${mensaje}`, 
            error?.message || '');
        if (error?.stack) {
            console.error(error.stack);
        }
    }

    warn(mensaje: string, datos?: any): void {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] [WARN] ${mensaje}`, 
            datos ? JSON.stringify(datos, null, 2) : '');
    }
}

// Implementación del servicio de notificaciones (simulado)
class ServicioNotificacionEmail implements ServicioNotificacion {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async enviarBienvenida(usuario: Usuario): Promise<void> {
        // Simular envío de email
        await this.simularEnvioEmail();
        this.logger.info('Email de bienvenida enviado', { 
            email: usuario.email,
            nombre: usuario.nombre 
        });
    }

    async notificarActualizacion(usuario: Usuario): Promise<void> {
        // Simular envío de email
        await this.simularEnvioEmail();
        this.logger.info('Notificación de actualización enviada', { 
            email: usuario.email 
        });
    }

    private async simularEnvioEmail(): Promise<void> {
        // Simular latencia de envío
        return new Promise(resolve => setTimeout(resolve, 200));
    }
}

// =============================================================================
// CONFIGURACIÓN Y FACTORY - Inyección de dependencias
// =============================================================================

class ConfiguradorAplicacion {  //Factory para configurar dependencias
    private repositorio: RepositorioUsuario; //Propiedades privadas para las dependencias
    private logger: Logger;
    private notificaciones: ServicioNotificacion;

    constructor() { //Constructor que instancia todas las dependencias
        // Configurar dependencias
        this.logger = new LoggerConsola(); //instancia del logger
        this.repositorio = new RepositorioUsuarioEnMemoria();//
        this.notificaciones = new ServicioNotificacionEmail(this.logger);//
    }

    crearUsuarioService(): UsuarioService {
        return new UsuarioService( //Inyecta todas las dependencias
            this.repositorio,
            this.logger,
            this.notificaciones
        );
    }
}

// =============================================================================
// CAPA DE PRESENTACIÓN - Punto de entrada y demostración
// =============================================================================

async function demostrarSistema() {
    console.log('='.repeat(70)); //Imprime encabezado
    console.log('DEMOSTRACIÓN DEL SISTEMA DE GESTIÓN DE USUARIOS');
    console.log('='.repeat(70));

    // Configurar aplicación
    const configurador = new ConfiguradorAplicacion();
    const usuarioService = configurador.crearUsuarioService();

    try { //Inicia bloque try-catch para manejo de errores
        // 1. Crear usuarios
        console.log('\n1. CREANDO USUARIOS...');
        
        const usuario1 = await usuarioService.agregarUsuario({
            nombre: "Juan Pérez",
            email: "juan@example.com"
        });
        console.log('✅ Usuario creado:', usuario1);//(repite para usuario2 y usuario3)

        const usuario2 = await usuarioService.agregarUsuario({
            nombre: "María García",
            email: "maria@example.com"
        });
        console.log('✅ Usuario creado:', usuario2);

        const usuario3 = await usuarioService.agregarUsuario({
            nombre: "Carlos López",
            email: "carlos@example.com"
        });
        console.log('✅ Usuario creado:', usuario3);

        // 2. Listar usuarios
        console.log('\n2. LISTANDO TODOS LOS USUARIOS...');
        const todosUsuarios = await usuarioService.obtenerUsuarios();
        console.log(`📋 Total de usuarios: ${todosUsuarios.length}`);
        todosUsuarios.forEach(usuario => {
            console.log(`   - ${usuario.nombre} (${usuario.email}) - ID: ${usuario.id}`);
        });

        // 3. Buscar por ID
        console.log('\n3. BUSCANDO USUARIO POR ID...');
        const usuarioEncontrado = await usuarioService.obtenerUsuarioPorId(usuario1.id);
        console.log('🔍 Usuario encontrado:', usuarioEncontrado);

        // 4. Actualizar usuario
        console.log('\n4. ACTUALIZANDO USUARIO...');
        const usuarioActualizado = await usuarioService.actualizarUsuario({
            id: usuario2.id,
            nombre: 'María García Silva',
            email: 'maria.silva@example.com'
        });
        console.log('✏️ Usuario actualizado:', usuarioActualizado);

        // 5. Eliminar usuario
        console.log('\n5. ELIMINANDO USUARIO...');
        const eliminado = await usuarioService.eliminarUsuario(usuario3.id);
        console.log('🗑️ Usuario eliminado:', eliminado);

        // 6. Verificar eliminación
        console.log('\n6. VERIFICANDO LISTA FINAL...');
        const usuariosFinales = await usuarioService.obtenerUsuarios();
        console.log(`📋 Usuarios restantes: ${usuariosFinales.length}`);
        usuariosFinales.forEach(usuario => {
            console.log(`   - ${usuario.nombre} (${usuario.email})`);
        });

    } catch (error) {
        console.error('💥 Error inesperado:', error);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✨ DEMOSTRACIÓN COMPLETADA');
    console.log('='.repeat(70));
}

// Ejecutar la demostración
demostrarSistema().catch(console.error);
