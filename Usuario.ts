// =============================================================================
// CAPA DE DOMINIO
// =============================================================================

// Entidad Usuario - Reglas de negocio
class Usuario {
    public readonly id: string;
    public readonly fechaCreacion: Date;

    constructor(
        public nombre: string, 
        public email: string,
        id?: string
    ) {
        this.id = id || this.generarId();
        this.fechaCreacion = new Date();
        this.validar();
    }

    private generarId(): string {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    private validar(): void {
        if (!this.nombre || this.nombre.trim().length < 2) {
            throw new Error('El nombre debe tener al menos 2 caracteres');
        }
        
        if (!this.email || !this.esEmailValido(this.email)) {
            throw new Error('El email debe tener un formato válido');
        }
    }

    private esEmailValido(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Método para actualizar información del usuario
    actualizarDatos(nuevoNombre?: string, nuevoEmail?: string): Usuario {
        const nombre = nuevoNombre || this.nombre;
        const email = nuevoEmail || this.email;
        return new Usuario(nombre, email, this.id);
    }

    // Método para comparar usuarios
    esIgual(otroUsuario: Usuario): boolean {
        return this.email === otroUsuario.email;
    }
}

// Excepciones del dominio
class UsuarioNoEncontradoError extends Error {
    constructor(criterio: string) {
        super(`Usuario no encontrado: ${criterio}`);
        this.name = 'UsuarioNoEncontradoError';
    }
}

class UsuarioDuplicadoError extends Error {
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
    guardar(usuario: Usuario): Promise<void>;
    obtenerPorId(id: string): Promise<Usuario | null>;
    obtenerPorEmail(email: string): Promise<Usuario | null>;
    obtenerTodos(): Promise<Usuario[]>;
    buscar(termino: string): Promise<Usuario[]>;
    eliminar(id: string): Promise<boolean>;
    existe(email: string): Promise<boolean>;
}

// Puerto para el logger
interface Logger {
    info(mensaje: string, datos?: any): void;
    error(mensaje: string, error?: Error): void;
    warn(mensaje: string, datos?: any): void;
}

// Puerto para notificaciones
interface ServicioNotificacion {
    enviarBienvenida(usuario: Usuario): Promise<void>;
    notificarActualizacion(usuario: Usuario): Promise<void>;
}

// =============================================================================
// CAPA DE APLICACIÓN - Casos de uso y lógica de aplicación
// =============================================================================

// DTOs (Data Transfer Objects)
interface CrearUsuarioDto {
    nombre: string;
    email: string;
}

interface ActualizarUsuarioDto {
    id: string;
    nombre?: string;
    email?: string;
}

interface UsuarioRespuestaDto {
    id: string;
    nombre: string;
    email: string;
    fechaCreacion: Date;
}

// Servicio de aplicación mejorado
class UsuarioService {
    constructor(
        private repositorio: RepositorioUsuario,
        private logger: Logger,
        private notificaciones: ServicioNotificacion
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
        this.logger.info('Buscando usuario por ID', { id });
        
        const usuario = await this.repositorio.obtenerPorId(id);
        if (!usuario) {
            this.logger.warn('Usuario no encontrado por ID', { id });
            throw new UsuarioNoEncontradoError(`ID: ${id}`);
        }

        return this.mapearADto(usuario);
    }


    // Actualizar usuario
    async actualizarUsuario(datos: ActualizarUsuarioDto): Promise<UsuarioRespuestaDto> {
        this.logger.info('Actualizando usuario', { id: datos.id });

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

        await this.repositorio.guardar(usuarioActualizado);

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

        const eliminado = await this.repositorio.eliminar(id);
        
        if (!eliminado) {
            this.logger.warn('No se pudo eliminar el usuario', { id });
            throw new UsuarioNoEncontradoError(`ID: ${id}`);
        }

        this.logger.info('Usuario eliminado exitosamente', { id });
        return true;
    }

    // Mapper privado
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
    private usuarios: Map<string, Usuario> = new Map();

    async guardar(usuario: Usuario): Promise<void> {
        this.usuarios.set(usuario.id, usuario);
    }

    async obtenerPorId(id: string): Promise<Usuario | null> {
        return this.usuarios.get(id) || null;
    }

    async obtenerPorEmail(email: string): Promise<Usuario | null> {
        for (const usuario of this.usuarios.values()) {
            if (usuario.email === email) {
                return usuario;
            }
        }
        return null;
    }

    async obtenerTodos(): Promise<Usuario[]> {
        return Array.from(this.usuarios.values());
    }

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

class ConfiguradorAplicacion {
    private repositorio: RepositorioUsuario;
    private logger: Logger;
    private notificaciones: ServicioNotificacion;

    constructor() {
        // Configurar dependencias
        this.logger = new LoggerConsola();
        this.repositorio = new RepositorioUsuarioEnMemoria();
        this.notificaciones = new ServicioNotificacionEmail(this.logger);
    }

    crearUsuarioService(): UsuarioService {
        return new UsuarioService(
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
    console.log('='.repeat(70));
    console.log('DEMOSTRACIÓN DEL SISTEMA DE GESTIÓN DE USUARIOS MEJORADO');
    console.log('='.repeat(70));

    // Configurar aplicación
    const configurador = new ConfiguradorAplicacion();
    const usuarioService = configurador.crearUsuarioService();

    try {
        // 1. Crear usuarios
        console.log('\n1. CREANDO USUARIOS...');
        
        const usuario1 = await usuarioService.agregarUsuario({
            nombre: "Juan Pérez",
            email: "juan@example.com"
        });
        console.log('✅ Usuario creado:', usuario1);

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
