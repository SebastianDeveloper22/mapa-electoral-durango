import MapPage from "./components/map/MapPage";

/**
 * App — Módulo de Programa Presupuestal (PP).
 * Maneja únicamente la ruta "/".
 *
 * La autenticación y el enrutamiento son responsabilidad de AppRouter,
 * por lo que aquí ya se asume que el usuario está autenticado.
 */
const App = () => {
  return (
    <div className="w-full h-full">
      <MapPage />
    </div>
  );
};

export default App;
