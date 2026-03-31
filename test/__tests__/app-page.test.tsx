import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
	it("renders heading text", () => {
		render(<Home />);

		expect(screen.getByText(/save and see your changes/i)).toBeInTheDocument();
	});
});
