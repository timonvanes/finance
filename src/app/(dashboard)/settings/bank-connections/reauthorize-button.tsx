import { reauthorizeBankLink } from "@/actions/bank-connections";

export function ReauthorizeButton({ bankConnectionId }: { bankConnectionId: string }) {
  return (
    <form action={reauthorizeBankLink}>
      <input type="hidden" name="bankConnectionId" value={bankConnectionId} />
      <button
        type="submit"
        className="min-h-[48px] rounded-xl bg-teal-700 px-5 text-base font-medium text-white active:bg-teal-800"
      >
        Opnieuw koppelen
      </button>
    </form>
  );
}
