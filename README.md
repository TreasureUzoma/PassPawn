# PassedPawn

PassedPawn is a powerful web application designed for comprehensive chess game analysis. It allows users to import games directly from Chess.com or by pasting Portable Game Notation (PGN) strings, providing in-depth engine analysis powered by Stockfish.js, detailed move ratings, and interactive playback features.

## Features

- **Interactive Chess Board**: A responsive and intuitive chess board component supporting drag-and-drop movements, pawn promotion, and FEN string display.
- **Stockfish.js Integration**: Real-time chess engine evaluation, best move suggestions, and full-game analysis to identify strengths and weaknesses.
- **Detailed Game Reports**: Get comprehensive insights into game performance with move-by-move ratings (Brilliant, Best, Inaccuracy, Mistake, Blunder), overall accuracy scores, and estimated player ratings.
- **Chess.com Integration**: Easily fetch and browse a player's complete game history and profile from Chess.com.
- **PGN Import**: Paste any PGN string to instantly load, visualize, and analyze games.
- **Game Playback Controls**: Navigate through game history with intuitive controls to fast-forward, rewind, or jump to specific moves.
- **Sandbox Mode**: Experiment with alternative moves and variations without altering the original game analysis.
- **Theming**: Seamlessly switch between dark and light modes for a personalized viewing experience.
- **Responsive Design**: Built with Svelte and Tailwind CSS for an optimal experience across various devices and screen sizes.
- **User Management (Planned/Backend)**: Features for user authentication, roles, and subscriptions, supported by a PostgreSQL database.

## Stacks / Technologies

| Category           | Technology            | Link                                                                                    |
| :----------------- | :-------------------- | :-------------------------------------------------------------------------------------- |
| **Frontend**       | SvelteKit             | [svelte.dev/kit](https://svelte.dev/kit)                                                |
| **Styling**        | Tailwind CSS          | [tailwindcss.com](https://tailwindcss.com)                                              |
| **UI Components**  | bits-ui               | [bits-ui.com](https://bits-ui.com)                                                      |
| **Icons**          | Lucide Svelte         | [lucide.dev](https://lucide.dev)                                                        |
| **Chess Logic**    | chess.js              | [chess.js.org](https://chess.js.org)                                                    |
| **Chess Engine**   | Stockfish.js          | [stockfishchess.org](https://stockfishchess.org)                                        |
| **Data Fetching**  | TanStack Svelte Query | [tanstack.com/query/latest/docs/svelte](https://tanstack.com/query/latest/docs/svelte)  |
| **HTTP Client**    | Axios                 | [axios-http.com](https://axios-http.com)                                                |
| **Database (ORM)** | Drizzle ORM           | [orm.drizzle.team](https://orm.drizzle.team)                                            |
| **Database**       | PostgreSQL (Neon)     | [neondatabase.com](https://neondatabase.com)                                            |
| **Testing**        | Vitest                | [vitest.dev](https://vitest.dev)                                                        |
| **Linting/Typing** | ESLint, TypeScript    | [eslint.org](https://eslint.org), [typescriptlang.org](https://www.typescriptlang.org/) |

## Installation

To set up the project locally, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/treasureuzoma/passedpawn.git
    cd passedpawn
    ```

2.  **Install dependencies:**

    This project uses `pnpm` as its package manager. If you don't have it, install it globally:

    ```bash
    npm install -g pnpm
    ```

    Then, install the project dependencies:

    ```bash
    pnpm install
    ```

3.  **Environment Variables:**

    Create a `.env` file in the root of the project and add your database connection string:

    ```env
    DATABASE_URL="your_postgresql_connection_string"
    ```

    (e.g., from Neon or another PostgreSQL provider).

4.  **Database Setup:**

    Run Drizzle migrations to set up your database schema:

    ```bash
    pnpm run db:push
    ```

    You can also generate new migrations or open the Drizzle Studio:

    ```bash
    pnpm run db:generate
    pnpm run db:studio
    ```

5.  **Start the development server:**

    ```bash
    pnpm run dev
    ```

    The application will be accessible at `http://localhost:5173`.

## Usage

Once the development server is running:

1.  **Import Games**: On the homepage, choose between "Chess.com" to enter a username or "Paste PGN" to input a game string.
2.  **Analyze**: After importing, the game will be displayed with Stockfish analysis, move ratings, and playback controls.
3.  **Interact**:
    - Use the navigation buttons to move through the game.
    - Click "Flip Board" to change the board orientation.
    - Toggle "Show Arrows" to display or hide the engine's best move suggestions.
    - Enter "Sandbox Mode" to try out your own moves.

## Contributing

We welcome contributions to PassedPawn! If you'd like to contribute, please follow these steps:

1.  **Fork the repository**.
2.  **Clone your forked repository**:
    ```bash
    git clone https://github.com/your-username/passedpawn.git
    cd passedpawn
    ```
3.  **Create a new branch**:
    ```bash
    git checkout -b feature/your-feature-name
    ```
4.  **Make your changes**.
5.  **Ensure code quality**:
    ```bash
    pnpm run format # Auto-format code
    pnpm run lint   # Check for linting errors
    pnpm run test   # Run unit tests
    ```
6.  **Commit your changes**:
    ```bash
    git commit -m "feat: Add your feature"
    ```
7.  **Push to your branch**:
    ```bash
    git push origin feature/your-feature-name
    ```
8.  **Open a Pull Request** against the `main` branch of the original repository.

[![Readme was generated by Readmit](https://img.shields.io/badge/Readme%20was%20generated%20by-Readmit-brightred)](https://readmit.vercel.app)
