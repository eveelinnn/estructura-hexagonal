// Capa de Dominio
//Declara una clase llamada Usuario
class Usuario {
    constructor(public nombre: string, public email: string) {}
}
    //Define un constructor para la clase Usuario. 
    //Este constructor toma dos parámetros, nombre y email, ambos de tipo string. 
    //La palabra public indica que estos parámetros se convertirán automáticamente en propiedades públicas de la clase,
    //lo que significa que se pueden acceder desde fuera de la clase.

// Capa de Aplicación
//Esta clase se encargará de gestionar la lógica relacionada con los usuarios.
class UsuarioService {
    private usuarios: Usuario[] = [];
   //Declara una propiedad privada llamada usuarios, que es un array (lista) que almacenará instancias de la clase Usuario.
   //La palabra private significa que esta propiedad no puede ser accedida directamente desde fuera de la clase.
    agregarUsuario(usuario: Usuario) {
   //Define un método público llamado agregarUsuario, que toma un parámetro usuario de tipo Usuario. 
   //Este método permite añadir un nuevo usuario a la lista.
        this.usuarios.push(usuario);
        //Usa el método push para añadir el usuario proporcionado al array usuarios.
    }

    obtenerUsuarios() {
    //Define un método público llamado obtenerUsuarios, que no toma parámetros. 
    //Este método se utiliza para recuperar la lista de usuarios.
        return this.usuarios;
        //Retorna el array usuarios, permitiendo el acceso a todos los usuarios almacenados.
    }
}

// Capa de Presentación
const usuarioService = new UsuarioService();
//Crea una nueva instancia de la clase UsuarioService y la asigna a la constante usuarioService. 
//Esto permite utilizar los métodos definidos en UsuarioService.
usuarioService.agregarUsuario(new Usuario("Juan", "juan@example.com"));
//Crea una nueva instancia de Usuario con el nombre "Juan" y el email "juan@example.com", 
//y la agrega a la lista de usuarios utilizando el método agregarUsuario.
console.log(usuarioService.obtenerUsuarios());
//Llama al método obtenerUsuarios de usuarioService para obtener la lista de usuarios y la imprime en la consola. 
//Esto mostrará el array de usuarios que contiene la instancia de "Juan".
