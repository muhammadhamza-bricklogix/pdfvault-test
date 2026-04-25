import { ConversionCards } from "@/components/sections/home/conversion-cards";
import { FeatureCards } from "@/components/sections/home/feature-cards";
import { HomeHero } from "@/components/sections/home/home-hero";

export default function Home() {
  return (
    <div className="flex w-full flex-col items-center">
      <HomeHero />
      <FeatureCards />
      <ConversionCards />
    </div>
  );
}
