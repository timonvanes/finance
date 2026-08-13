import { reauthorizeBankLink } from "@/actions/bank-connections";

export function ReauthorizeButton({ bankConnectionId }: { bankConnectionId: string }) {
  return (
    <form action={reauthorizeBankLink}>
      <input type="hidden" name="bankConnectionId" value={bankConnectionId} />
      <button
        type="submit"
        className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
      >
        Opnieuw koppelen
      </button>
    </form>
  );
}
