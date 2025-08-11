import { Link } from "wouter";
import Navigation from "@/components/navigation";
import GameCard from "@/components/game-card";

export default function Games() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-surface to-dark">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">Game Lobby 🎯</h1>
          <p className="text-gray-400">Choose your game and test your luck!</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Game 1: Six-Color Challenge */}
          <GameCard
            title="Six-Color Challenge"
            description="Pick up to 3 colors and win if the random color matches your selection!"
            preview={
              <div className="h-48 bg-gradient-to-br from-primary via-secondary to-accent p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded-full px-3 py-1 text-sm font-semibold text-white">
                  Live
                </div>
                <div className="flex flex-wrap gap-2 mt-8">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-lg"></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg"></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg"></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 shadow-lg"></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-lg"></div>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 shadow-lg"></div>
                </div>
                <h3 className="text-2xl font-bold text-white mt-4">Six-Color Challenge</h3>
              </div>
            }
            rules={[
              { label: "1 Color:", reward: "20 → 40 Points" },
              { label: "2 Colors:", reward: "30 → 60 Points" },
              { label: "3 Colors:", reward: "45 → 90 Points" },
            ]}
            href="/color-game"
            buttonText="Play Now"
            buttonGradient="from-primary to-secondary"
          />

          {/* Game 2: Aviator */}
          <GameCard
            title="Aviator"
            description="Watch the multiplier rise and cash out before the plane flies away!"
            preview={
              <div className="h-48 bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-500 p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 rounded-full px-3 py-1 text-sm font-semibold text-white">
                  Live
                </div>
                <div className="absolute bottom-8 left-8">
                  <div className="text-4xl text-white opacity-80 transform rotate-12">✈️</div>
                </div>
                <div className="absolute top-8 right-16 text-3xl font-bold text-white animate-pulse">
                  2.45x
                </div>
                <h3 className="text-2xl font-bold text-white mt-16">Aviator</h3>
                <p className="text-blue-200 text-sm">Cash out before you crash out!</p>
              </div>
            }
            rules={[
              { label: "Min Bet:", reward: "10 Points" },
              { label: "Max Multiplier:", reward: "∞" },
              { label: "House Edge:", reward: "3%" },
            ]}
            href="/aviator-game"
            buttonText="Take Flight"
            buttonGradient="from-secondary to-primary"
          />
        </div>
      </main>
    </div>
  );
}
