import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayIcon } from "lucide-react";

interface GameRule {
  label: string;
  reward: string;
}

interface GameCardProps {
  title: string;
  description: string;
  preview: React.ReactNode;
  rules: GameRule[];
  href: string;
  buttonText: string;
  buttonGradient: string;
}

export default function GameCard({ 
  title, 
  description, 
  preview, 
  rules, 
  href, 
  buttonText, 
  buttonGradient 
}: GameCardProps) {
  return (
    <Card className="bg-surface/80 border-surface-light backdrop-blur-sm overflow-hidden hover:border-primary transition-colors duration-300">
      {preview}
      
      <CardContent className="p-6">
        <p className="text-gray-400 mb-4">{description}</p>
        
        <div className="space-y-3 mb-6">
          {rules.map((rule, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className="text-gray-300">{rule.label}</span>
              <span className="text-accent font-semibold">{rule.reward}</span>
            </div>
          ))}
        </div>
        
        <Link href={href}>
          <Button className={`w-full bg-gradient-to-r ${buttonGradient} text-white font-semibold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity`}>
            <PlayIcon className="w-4 h-4 mr-2" />
            {buttonText}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
