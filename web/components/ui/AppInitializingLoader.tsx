const spinnerSegments = Array.from({ length: 12 }, (_, index) => ({
  opacity: 0.22 + index * 0.065,
  transform: `translate(-50%, -50%) rotate(${index * 30}deg) translateY(-22px)`,
}));

export function AppInitializingLoader() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex h-dvh min-h-svh w-full items-center justify-center overflow-hidden bg-white px-6 text-slate-900"
    >
      <div className="flex items-center justify-center">
        <span aria-hidden="true" className="relative h-14 w-14 animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none">
          {spinnerSegments.map((segment, index) => (
            <span
              className="absolute left-1/2 top-1/2 h-4 w-1 rounded-full bg-purple-600"
              key={index}
              style={segment}
            />
          ))}
        </span>
        <span className="sr-only">Loading</span>
      </div>
    </main>
  );
}
