/* leny/enigjewo
 *
 * /src/components/game/lobby.js - Game Component: Lobby
 *
 * coded by leny
 * started at 09/02/2021
 */

import PropTypes from "prop-types";

import "styles/lobby.scss";

import {
    useCallback,
    useMemo,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import {GameStoreContext} from "store/game";

import {
    NBSP,
    BSP,
    GAME_VARIANT_CHALLENGE,
    GAME_RULES_CLASSIC,
    GAME_RULES_STATIONARY,
    GAME_RULES_GUESS_COUNTRY,
    GAME_RULES_EMOJIS,
    GAME_RULES_NAMES,
} from "core/constants";
import {maps, loadGeoJSON} from "core/maps";
import {getMarkerIcon} from "core/icons";
import {readableDuration} from "core/utils";
import bbox from "@turf/bbox";
import classnames from "classnames";
import {db} from "core/firebase";
import receivingPlayerInfos from "store/game/actions/receiving-player-infos";
import receivingRoundParams from "store/game/actions/receiving-round-params";

import Box from "components/commons/box";
import Button from "components/commons/button";
import GMap from "components/commons/map";
import Copiable from "components/commons/copiable";

const Lobby = ({onStartMatch}) => {
    const gmap = useRef(null);
    const [preparing, setPreparing] = useState(false);
    const {
        dispatch,
        variant,
        code,
        title,
        progressCount,
        settings: {map, rounds, duration, rules},
        players,
        player: key,
    } = useContext(GameStoreContext);
    const player = players[key];
    const gameURL = `${location.protocol}//${location.host}${location.pathname}?c=${code}`;

    const handleStartMatch = useCallback(() => {
        setPreparing(true);
        onStartMatch();
    }, [setPreparing, onStartMatch]);

    const rulesExplain = useMemo(
        () =>
            ({
                [GAME_RULES_CLASSIC]:
                    "Moving around and using what you see, try to pin your drop point on a map.",
                [GAME_RULES_STATIONARY]: (
                    <>
                        {"You can't move on StreetView!"}
                        <br />
                        {
                            "Using only what you see around you, can you guess your drop point on the map?"
                        }
                        <br />
                        {"Not an easy task, indeed!"}
                    </>
                ),
                [GAME_RULES_GUESS_COUNTRY]: (
                    <>
                        {
                            "Moving around and using what you see, can you guess the country you're in?!"
                        }
                        <br />
                        {"This seems easier, but sometimes, it's tricky!"}
                    </>
                ),
            }[rules]),
        [rules],
    );

    useEffect(() => {
        db.ref(`games/${code}/players`).on(
            "child_added",
            snapshot =>
                snapshot.key !== key &&
                dispatch(
                    receivingPlayerInfos({
                        key: snapshot.key,
                        player: snapshot.val(),
                    }),
                ),
        );
        db.ref(`games/${code}/currentRound`).once("child_added", () =>
            dispatch(receivingRoundParams(code)),
        );
        return () => {
            db.ref(`games/${code}/players`).off("child_added");
        };
    }, []);

    useEffect(() => {
        if (!gmap.current) {
            return;
        }

        gmap.current.setZoom(1);
        gmap.current.setCenter({lat: 0, lng: 0});
        gmap.current.data.forEach(f => gmap.current.data.remove(f));

        if (map !== "world") {
            (async () => {
                const geoJSON = await loadGeoJSON(map);
                const [west, south, east, north] = bbox(geoJSON);
                gmap.current.data.addGeoJson(geoJSON);
                gmap.current.data.setStyle({
                    fillColor: "hsl(204, 86%, 53%)",
                    strokeColor: "hsl(217, 71%, 53%)",
                    strokeWeight: 2,
                });
                gmap.current.fitBounds({north, east, south, west});
            })();
        }
    }, [map]);

    let $footer = (
        <span
            className={classnames(
                "button",
                "is-static",
                "card-footer-item",
                "no-top-radius",
            )}>
            {`Waiting for ${
                Object.values(players).find(({isOwner}) => isOwner).name
            } to start the game…`}
        </span>
    );

    if (player.isOwner || variant === GAME_VARIANT_CHALLENGE) {
        const playersCount = Object.keys(players).length;

        let label = "Start Game";

        if (playersCount < 2) {
            label = "Waiting for players…";
        }

        if (preparing) {
            label = `Finding new location (attempt #${progressCount})…`;
        }

        if (variant === GAME_VARIANT_CHALLENGE) {
            label = "Start Challenge";
        }

        $footer = (
            <Button
                type={"button"}
                disabled={preparing || playersCount < 2}
                label={label}
                variant={"link"}
                className={classnames("card-footer-item", "no-top-radius")}
                onClick={handleStartMatch}
            />
        );
    }

    return (
        <div className={classnames("columns", "is-centered")}>
            <div
                className={classnames(
                    "column",
                    "is-three-quarters",
                    "section",
                )}>
                <Box title={title} footer={$footer}>
                    {player.isOwner && (
                        <div
                            className={classnames(
                                "card-content",
                                "has-text-centered",
                            )}>
                            <div className={classnames("mb-2")}>
                                <strong
                                    className={classnames(
                                        "is-block",
                                        "is-size-2",
                                        "is-family-code",
                                    )}>
                                    <Copiable text={code}>{code}</Copiable>
                                </strong>
                                <span
                                    className={("is-size-5", "is-family-code")}>
                                    <Copiable text={gameURL}>
                                        {gameURL}
                                    </Copiable>
                                </span>
                            </div>
                            <div
                                className={classnames(
                                    "notification",
                                    "is-info",
                                    "is-light",
                                )}>
                                {
                                    "Send the code or the URL to the players & wait for them to join the game."
                                }
                            </div>
                        </div>
                    )}
                    <div
                        className={classnames(
                            "card-image",
                            "columns",
                            "mx-0",
                            "mb-0",
                            "mt-0",
                        )}>
                        <div
                            className={classnames(
                                "column",
                                "is-two-thirds",
                                "p-0",
                                "has-background-info-light",
                            )}>
                            <GMap
                                className={
                                    player.isOwner
                                        ? "lobby__map"
                                        : "lobby__map--extended"
                                }
                                ref={gmap}
                            />
                        </div>
                        <div
                            className={classnames(
                                "column",
                                `pt-${player.isOwner ? "0" : "2"}`,
                            )}>
                            {variant === GAME_VARIANT_CHALLENGE && (
                                <p>
                                    {"This game is a"}
                                    {BSP}
                                    <strong>{"Challenge"}</strong>
                                    {
                                        ": the other players already did their rounds. Play on your side and compare your score with them at the end!"
                                    }
                                </p>
                            )}
                            <hr />
                            <ul>
                                <li>
                                    <strong>{"Rounds:"}</strong>
                                    {NBSP}
                                    {rounds}
                                </li>
                                <li>
                                    <strong>{"Duration:"}</strong>
                                    {NBSP}
                                    {duration
                                        ? readableDuration(duration)
                                        : "Infinite"}
                                </li>
                                <li>
                                    <strong>{"Map:"}</strong>
                                    {NBSP}
                                    {maps[map].label}
                                </li>
                                <li>
                                    <strong>{"Rules:"}</strong>
                                    {NBSP}
                                    <span>
                                        {`${GAME_RULES_EMOJIS[rules]}${NBSP}${NBSP}${GAME_RULES_NAMES[rules]}`}
                                    </span>
                                    <br />

                                    <small className={"has-text-grey"}>
                                        {rulesExplain}
                                    </small>
                                </li>
                            </ul>
                            <hr />
                            <h6
                                className={classnames(
                                    "has-text-centered",
                                    "mb-3",
                                )}>
                                {"Players"}
                            </h6>
                            <ul>
                                {Object.values(players).map(({name, icon}) => (
                                    <li key={name}>
                                        <img
                                            className={"lobby__player-icon"}
                                            src={getMarkerIcon(icon).url}
                                        />
                                        {NBSP}
                                        {name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Box>
            </div>
        </div>
    );
};

Lobby.propTypes = {
    onStartMatch: PropTypes.func.isRequired,
};

export default Lobby;
