import aadharLogo from "../../../assets/document/aadhar_logo.jpg";
import panLogo from "../../../assets/document/pan_logo.png";
import drivingLogo from "../../../assets/document/driving_logo.png";
import { cn } from "@/lib/utils";

interface LogoIconProps {
  className?: string;
}

export function AadharIcon({ className }: LogoIconProps) {
  return (
    <img
      src={aadharLogo}
      alt="Aadhar"
      className={cn("object-contain", className)}
    />
  );
}

export function PanIcon({ className }: LogoIconProps) {
  return (
    <img src={panLogo} alt="PAN" className={cn("object-contain", className)} />
  );
}

export function DrivingLicenseIcon({ className }: LogoIconProps) {
  return (
    <img
      src={drivingLogo}
      alt="Driving License"
      className={cn("object-contain", className)}
    />
  );
}
