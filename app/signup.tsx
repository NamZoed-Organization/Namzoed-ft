import SignupTab1 from "@/components/SignupTab1";
import SignupTab2 from "@/components/SignupTab2";
import { useState } from "react";

export default function Signup() {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <>
      {step === 1 ? (
        <SignupTab1 onNext={() => setStep(2)} />
      ) : (
        <SignupTab2 onPrev={()=>setStep(1)} />
      )}
    </>
  );
}
