
from app.rag.retriever import search_page


PAGE_ID = "9757679eb1ea94a3a3677b87"


questions = [
    "What is cricket?",
    "How many players are in a cricket team?",
    "What is the role of a wicket-keeper?",
    "What are the different formats of cricket?",
    "How can a batter be dismissed?"
]


def main():

    for question in questions:

        print("\n" + "=" * 70)
        print("QUESTION:", question)
        print("=" * 70)

        result = search_page(
            page_id=PAGE_ID,
            question=question,
            top_k=3
        )

        for match in result["results"]:

            print(
                f"\nRank: {match['rank']}"
            )

            print(
                f"Heading: {match['heading']}"
            )

            print(
                f"Similarity: {match['similarity']:.4f}"
            )

            print(
                f"Section: {match['section_id']}"
            )

            print(
                "Text:",
                match["text"][:350]
            )


if __name__ == "__main__":
    main()
