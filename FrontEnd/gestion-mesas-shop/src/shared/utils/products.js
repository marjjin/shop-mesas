// Los servicios de coworking se reconocen por el nombre, igual que en el backend.
export const isCoworkingService = (product) => product.name.startsWith('Servicio Coworking ')
