export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-gray-700">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Privacybeleid</h1>
      <p className="mb-3">
        Dit is een privé applicatie voor persoonlijk gebruik door een enkele
        gebruiker (de eigenaar van deze applicatie). De app wordt niet
        publiek aangeboden en verzamelt geen gegevens van andere personen.
      </p>
      <p className="mb-3">
        Bankgegevens die via Enable Banking worden opgehaald (transacties en
        saldi) worden uitsluitend opgeslagen in de eigen database van de
        eigenaar en gebruikt om een persoonlijk financieel overzicht te
        tonen. Gegevens worden niet gedeeld met derden.
      </p>
      <p>
        Vragen over gegevensverwerking kunnen gestuurd worden naar het
        e-mailadres van de eigenaar van deze applicatie.
      </p>
    </div>
  );
}
