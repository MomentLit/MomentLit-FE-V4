import Image from "next/image";

type OAuthProvider = "google" | "naver" | "kakao";

const PROVIDER_STYLES: Record<OAuthProvider, string> = {
  google: "bg-gray-100 text-gray-900",
  naver: "bg-[#06be34] text-white",
  kakao: "bg-[#fae100] text-gray-900",
};

const PROVIDER_ICON: Record<OAuthProvider, string> = {
  google: "/images/oauth/google.svg",
  naver: "/images/oauth/naver.svg",
  kakao: "/images/oauth/kakao.png",
};

interface OAuthButtonProps {
  provider: OAuthProvider;
  label: string;
}

/** OAuth는 provider 로그인 화면이 팝업/iframe 임베드를 막기 때문에 전체 페이지 이동으로 처리한다. */
export function OAuthButton({ provider, label }: OAuthButtonProps) {
  const baseURL = process.env.NEXT_PUBLIC_API_URL;
  const href = baseURL ? `${baseURL}/auth/oauth/${provider}` : "#";

  return (
    <a
      href={href}
      className={`flex w-full items-center justify-center gap-3 rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:brightness-95 active:translate-y-0 active:brightness-90 ${PROVIDER_STYLES[provider]}`}
    >
      <Image src={PROVIDER_ICON[provider]} alt="" width={18} height={18} />
      {label}
    </a>
  );
}
